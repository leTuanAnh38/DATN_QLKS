import React, { useState, useEffect } from 'react';
import {
    QrCode,
    Building2,
    CreditCard,
    User,
    Save,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Check,
    Copy,
    ShieldCheck,
    Sparkles,
    Info,
    Edit3,
    X,
    Clock,
    Phone,
    Mail,
    Globe,
    FileText,
    Star,
    Calculator,
    Percent,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Sliders,
    Building,
    Image as ImageIcon,
    Upload,
    Trash2,
    ExternalLink,
    RotateCcw,
    Eye,
    Camera,
    Palette
} from 'lucide-react';
import api from '../../services/api';
import { useHasPermission } from '../../utils/permission';
import { hotelSettingStore, DEFAULT_BANNERS, applyFavicon } from '../../store/hotelSettingStore';

// Danh sách các ngân hàng phổ biến tại Việt Nam hỗ trợ chuẩn VietQR Napas247
const POPULAR_BANKS = [
    { bin: '970422', shortName: 'MB Bank', fullName: 'Ngân hàng TMCP Quân Đội' },
    { bin: '970436', shortName: 'Vietcombank', fullName: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
    { bin: '970415', shortName: 'VietinBank', fullName: 'Ngân hàng TMCP Công Thương Việt Nam' },
    { bin: '970418', shortName: 'BIDV', fullName: 'Ngân hàng TMCP Đầu Tư và Phát Triển Việt Nam' },
    { bin: '970407', shortName: 'Techcombank', fullName: 'Ngân hàng TMCP Kỹ Thương Việt Nam' },
    { bin: '970416', shortName: 'ACB', fullName: 'Ngân hàng TMCP Á Châu' },
    { bin: '970432', shortName: 'VPBank', fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
    { bin: '970423', shortName: 'TPBank', fullName: 'Ngân hàng TMCP Tiên Phong' },
    { bin: '970403', shortName: 'Sacombank', fullName: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
    { bin: '970405', shortName: 'Agribank', fullName: 'Ngân hàng Nông Nghiệp và Phát Triển Nông Thôn' },
    { bin: '970443', shortName: 'SHB', fullName: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
    { bin: '970437', shortName: 'HDBank', fullName: 'Ngân hàng TMCP Phát Triển TP.HCM' },
    { bin: '970426', shortName: 'MSB', fullName: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
    { bin: '970448', shortName: 'OCB', fullName: 'Ngân hàng TMCP Phương Đông' },
    { bin: '970441', shortName: 'VIB', fullName: 'Ngân hàng TMCP Quốc Tế Việt Nam' },
];

export default function SystemSettings() {
    const canUpdateSettings = useHasPermission('settings', 'update');

    // TAB ĐIỀU HƯỚNG HIỆN TẠI
    const [activeTab, setActiveTab] = useState('hotel_info'); // 'hotel_info' | 'page_banners' | 'checkin_checkout' | 'policies' | 'vietqr'

    // ==========================================
    // 1. STATE & XỬ LÝ: CẤU HÌNH THANH TOÁN VIETQR
    // ==========================================
    const [qrFormData, setQrFormData] = useState({
        bank_bin: '',
        account_no: '',
        account_name: ''
    });
    const [savedQrData, setSavedQrData] = useState({
        bank_bin: '',
        account_no: '',
        account_name: ''
    });
    const [isEditingQr, setIsEditingQr] = useState(false);
    const [isSavingQr, setIsSavingQr] = useState(false);
    const [qrLastUpdated, setQrLastUpdated] = useState(null);

    // ==========================================
    // 2. STATE & XỬ LÝ: THÔNG TIN KHÁCH SẠN & VẬN HÀNH
    // ==========================================
    const [hotelData, setHotelData] = useState({
        hotel_name: 'Khách Sạn TA Đà Nẵng',
        hotel_slogan: '5-Star Luxury Resort & Hotel',
        stars: 5,
        address: '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
        hotline: '1900 8899',
        phone_number: '+84 (0) 236 388 9900',
        email: 'contact@tahotel.vn',
        website: 'https://tahotel.vn',
        tax_code: '0401234567',
        description: 'Kiệt tác nghỉ dưỡng 5 sao giao hòa giữa vẻ đẹp di sản truyền thống và kiến trúc hiện đại chuẩn quốc tế. Nơi tái định nghĩa chuẩn mực sang trọng và sự thư thái tinh khiết.',
        logo_url: '',
        favicon_url: '',
        banner_home: DEFAULT_BANNERS.banner_home,
        banner_home_2: DEFAULT_BANNERS.banner_home_2,
        banner_home_3: DEFAULT_BANNERS.banner_home_3,
        banner_rooms: DEFAULT_BANNERS.banner_rooms,
        banner_services: DEFAULT_BANNERS.banner_services,
        banner_promotions: DEFAULT_BANNERS.banner_promotions,
        banner_news: DEFAULT_BANNERS.banner_news,
        banner_contact: DEFAULT_BANNERS.banner_contact,
        banner_corporate: DEFAULT_BANNERS.banner_corporate,
        check_in_time: '14:00',
        check_out_time: '12:00',
        early_checkin_before_6am: 100,
        early_checkin_6am_9am: 50,
        early_checkin_9am_12pm: 30,
        late_checkout_12pm_3pm: 30,
        late_checkout_3pm_6pm: 50,
        late_checkout_after_6pm: 100,
        vat_percent: 8,
        service_charge_percent: 5,
        group_deposit_percent: 50,
        auto_cancel_minutes: 30,
        cancellation_free_hours: 48,
    });
    const [savedHotelData, setSavedHotelData] = useState({ ...hotelData });
    const [isEditingHotel, setIsEditingHotel] = useState(false);
    const [isSavingHotel, setIsSavingHotel] = useState(false);
    const [hotelLastUpdated, setHotelLastUpdated] = useState(null);

    // ==========================================
    // 3. STATE CHUNG: LOADING, TOAST & SIMULATOR
    // ==========================================
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [copiedField, setCopiedField] = useState(null);
    const [uploadingField, setUploadingField] = useState(null);

    // Trình mô phỏng tính phụ thu trực quan (Tab Giờ giấc & Phụ thu)
    const [simType, setSimType] = useState('late_checkout'); // 'early_checkin' | 'late_checkout'
    const [simHour, setSimHour] = useState('14:30');
    const [simRoomRate, setSimRoomRate] = useState(1500000);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // TẢI DỮ LIỆU CẢ 2 NGUỒN TỪ BACKEND
    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [qrRes, hotelRes] = await Promise.allSettled([
                api.get('/payments/config/'),
                api.get('/hotel-settings/')
            ]);

            // 1. Cấu hình VietQR
            if (qrRes.status === 'fulfilled' && qrRes.value?.data) {
                const qData = qrRes.value.data?.data || qrRes.value.data;
                const initialQr = {
                    bank_bin: qData.bank_bin || '970422',
                    account_no: qData.account_no || '123456789',
                    account_name: (qData.account_name || 'KHACH SAN TA DA NANG').toUpperCase()
                };
                setQrFormData(initialQr);
                setSavedQrData(initialQr);
                setIsEditingQr(false);
                if (qData.updated_at) setQrLastUpdated(qData.updated_at);
            }

            // 2. Cấu hình Khách sạn & Vận hành
            if (hotelRes.status === 'fulfilled' && hotelRes.value?.data) {
                const hData = hotelRes.value.data?.data || hotelRes.value.data;
                if (hData) {
                    setHotelData(hData);
                    setSavedHotelData(hData);
                    setIsEditingHotel(false);
                    if (hData.updated_at) setHotelLastUpdated(hData.updated_at);
                }
            }
        } catch (error) {
            console.error('Lỗi khi tải cấu hình hệ thống:', error);
            showToast('error', 'Không thể kết nối đến máy chủ để tải dữ liệu.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // ----------------------------------------
    // HANDLERS CHO CẤU HÌNH VIETQR
    // ----------------------------------------
    const handleStartEditQr = () => {
        if (!canUpdateSettings) {
            showToast('error', 'Bạn chỉ có quyền xem, không được phép chỉnh sửa.');
            return;
        }
        setIsEditingQr(true);
    };

    const handleCancelEditQr = () => {
        setQrFormData({ ...savedQrData });
        setIsEditingQr(false);
    };

    const handleSelectBank = (bin) => {
        if (!isEditingQr) return;
        setQrFormData(prev => ({ ...prev, bank_bin: bin }));
    };

    const currentBank = POPULAR_BANKS.find(b => b.bin === qrFormData.bank_bin);

    const handleSubmitQr = async (e) => {
        if (e) e.preventDefault();
        if (!canUpdateSettings) {
            showToast('error', 'Bạn không có quyền sửa đổi cấu hình hệ thống.');
            return;
        }
        if (!qrFormData.bank_bin.trim() || !qrFormData.account_no.trim() || !qrFormData.account_name.trim()) {
            showToast('error', 'Vui lòng điền đủ Mã BIN, Số tài khoản và Tên chủ tài khoản.');
            return;
        }

        setIsSavingQr(true);
        try {
            const payload = {
                bank_bin: qrFormData.bank_bin.trim(),
                account_no: qrFormData.account_no.trim(),
                account_name: qrFormData.account_name.trim().toUpperCase()
            };
            const response = await api.put('/payments/config/', payload);
            const resData = response.data?.data || response.data;
            if (resData) {
                const updated = {
                    bank_bin: resData.bank_bin,
                    account_no: resData.account_no,
                    account_name: resData.account_name.toUpperCase()
                };
                setQrFormData(updated);
                setSavedQrData(updated);
                setIsEditingQr(false);
                if (resData.updated_at) setQrLastUpdated(resData.updated_at);
            }
            showToast('success', 'Lưu cấu hình thanh toán VietQR thành công!');
        } catch (error) {
            console.error('Lỗi khi lưu VietQR:', error);
            showToast('error', error.response?.data?.message || 'Không thể lưu cấu hình VietQR.');
        } finally {
            setIsSavingQr(false);
        }
    };

    // ----------------------------------------
    // HANDLERS CHO CẤU HÌNH KHÁCH SẠN & VẬN HÀNH
    // ----------------------------------------
    const handleStartEditHotel = () => {
        if (!canUpdateSettings) {
            showToast('error', 'Bạn chỉ có quyền xem, không được phép chỉnh sửa.');
            return;
        }
        setIsEditingHotel(true);
    };

    const handleCancelEditHotel = () => {
        setHotelData({ ...savedHotelData });
        setIsEditingHotel(false);
    };

    const handleSubmitHotel = async (e) => {
        if (e) e.preventDefault();
        if (!canUpdateSettings) {
            showToast('error', 'Bạn không có quyền sửa đổi cấu hình hệ thống.');
            return;
        }
        if (!hotelData.hotel_name.trim()) {
            showToast('error', 'Tên khách sạn không được để trống.');
            return;
        }

        setIsSavingHotel(true);
        try {
            const response = await api.put('/hotel-settings/', hotelData);
            const resData = response.data?.data || response.data;
            if (resData) {
                setHotelData(resData);
                setSavedHotelData(resData);
                hotelSettingStore.updateSettings(resData);
                setIsEditingHotel(false);
                if (resData.updated_at) setHotelLastUpdated(resData.updated_at);
            }
            showToast('success', response.data?.message || 'Cập nhật cài đặt khách sạn & vận hành thành công!');
        } catch (error) {
            console.error('Lỗi khi lưu cài đặt khách sạn:', error);
            showToast('error', error.response?.data?.message || 'Không thể lưu cài đặt hệ thống.');
        } finally {
            setIsSavingHotel(false);
        }
    };

    // Tải ảnh độc lập lên máy chủ (Media Upload API)
    const handleUploadImage = async (file, fieldName) => {
        if (!file) return;
        if (!canUpdateSettings) {
            showToast('error', 'Bạn chỉ có quyền xem, không được phép tải ảnh.');
            return;
        }

        // Giới hạn 10MB
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', 'Kích thước ảnh vượt quá 10MB. Vui lòng nén ảnh trước khi tải.');
            return;
        }

        setUploadingField(fieldName);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await api.post('/upload-image/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data?.success && res.data?.url) {
                const newUrl = res.data.url;
                setHotelData(prev => ({ ...prev, [fieldName]: newUrl }));
                showToast('success', 'Tải ảnh lên thành công! Nhớ nhấn nút Lưu để áp dụng.');
            } else {
                showToast('error', res.data?.message || 'Không thể tải ảnh lên máy chủ.');
            }
        } catch (error) {
            console.error('Lỗi khi tải ảnh:', error);
            showToast('error', error.response?.data?.message || 'Lỗi kết nối máy chủ khi tải ảnh.');
        } finally {
            setUploadingField(null);
        }
    };

    // Lưu riêng cấu hình Banner các trang
    const handleSaveBanners = async () => {
        if (!canUpdateSettings) {
            showToast('error', 'Bạn không có quyền sửa đổi cấu hình hệ thống.');
            return;
        }

        setIsSavingHotel(true);
        try {
            const payload = {
                banner_home: hotelData.banner_home || DEFAULT_BANNERS.banner_home,
                banner_home_2: hotelData.banner_home_2 || DEFAULT_BANNERS.banner_home_2,
                banner_home_3: hotelData.banner_home_3 || DEFAULT_BANNERS.banner_home_3,
                banner_rooms: hotelData.banner_rooms || DEFAULT_BANNERS.banner_rooms,
                banner_services: hotelData.banner_services || DEFAULT_BANNERS.banner_services,
                banner_corporate: hotelData.banner_corporate || DEFAULT_BANNERS.banner_corporate,
                banner_news: hotelData.banner_news || DEFAULT_BANNERS.banner_news,
                banner_promotions: hotelData.banner_promotions || DEFAULT_BANNERS.banner_promotions,
                banner_contact: hotelData.banner_contact || DEFAULT_BANNERS.banner_contact,
            };
            const response = await api.patch('/hotel-settings/', payload);
            const resData = response.data?.data || response.data;
            if (resData) {
                setHotelData(prev => ({ ...prev, ...resData }));
                setSavedHotelData(prev => ({ ...prev, ...resData }));
                hotelSettingStore.updateSettings(resData);
                if (resData.updated_at) setHotelLastUpdated(resData.updated_at);
            }
            showToast('success', 'Lưu thiết lập banner các trang thành công!');
        } catch (error) {
            console.error('Lỗi khi lưu banner:', error);
            showToast('error', error.response?.data?.message || 'Không thể lưu cài đặt banner.');
        } finally {
            setIsSavingHotel(false);
        }
    };

    // Helper sao chép nhanh
    const handleCopy = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formatDateTime = (isoString) => {
        if (!isoString) return 'Chưa có thông tin';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return isoString;
        }
    };

    // Preview URL VietQR Napas247 demo
    const demoAmount = 100000;
    const demoContent = `DAT PHONG ${hotelData.hotel_name || 'KHACH SAN'}`.slice(0, 30);
    const previewQrUrl = qrFormData.bank_bin && qrFormData.account_no
        ? `https://img.vietqr.io/image/${qrFormData.bank_bin}-${qrFormData.account_no}-compact2.jpg?amount=${demoAmount}&addInfo=${encodeURIComponent(demoContent)}&accountName=${encodeURIComponent(qrFormData.account_name)}`
        : '';

    // Helper tính toán mô phỏng phụ thu (Live Surcharge Simulator)
    const calculateSimSurcharge = () => {
        const rate = Number(simRoomRate) || 0;
        const [h, m] = (simHour || '12:00').split(':').map(Number);
        const timeDecimal = (h || 0) + (m || 0) / 60;

        if (simType === 'early_checkin') {
            if (timeDecimal < 6) {
                const percent = Number(hotelData.early_checkin_before_6am) || 100;
                return { percent, amount: (rate * percent) / 100, rule: 'Trước 06:00 sáng' };
            }
            if (timeDecimal < 9) {
                const percent = Number(hotelData.early_checkin_6am_9am) || 50;
                return { percent, amount: (rate * percent) / 100, rule: '06:00 - 09:00 sáng' };
            }
            if (timeDecimal < 14) {
                const percent = Number(hotelData.early_checkin_9am_12pm) || 30;
                return { percent, amount: (rate * percent) / 100, rule: '09:00 - 14:00 trưa' };
            }
            return { percent: 0, amount: 0, rule: 'Đúng / Sau giờ Check-in chuẩn (14:00)' };
        } else {
            // Late checkout (chuẩn 12:00)
            if (timeDecimal <= 12) {
                return { percent: 0, amount: 0, rule: 'Đúng giờ Check-out chuẩn (<= 12:00)' };
            }
            if (timeDecimal <= 15) {
                const percent = Number(hotelData.late_checkout_12pm_3pm) || 30;
                return { percent, amount: (rate * percent) / 100, rule: '12:00 - 15:00 chiều' };
            }
            if (timeDecimal <= 18) {
                const percent = Number(hotelData.late_checkout_3pm_6pm) || 50;
                return { percent, amount: (rate * percent) / 100, rule: '15:00 - 18:00 chiều' };
            }
            const percent = Number(hotelData.late_checkout_after_6pm) || 100;
            return { percent, amount: (rate * percent) / 100, rule: 'Sau 18:00 tối (Tính trọn 1 đêm)' };
        }
    };

    const simResult = calculateSimSurcharge();

    // DANH SÁCH 5 TABS HỆ THỐNG
    const TABS = [
        { id: 'hotel_info', label: 'Thông tin & Logo', icon: Building2, badge: 'Thương hiệu' },
        { id: 'page_banners', label: 'Banner Các Trang', icon: ImageIcon, badge: 'Giao diện' },
        { id: 'checkin_checkout', label: 'Giờ giấc & Phụ thu', icon: Clock, badge: 'Vận hành' },
        { id: 'policies', label: 'Thuế & Chính sách cọc', icon: Percent, badge: 'Tài chính' },
        { id: 'vietqr', label: 'Thanh toán VietQR', icon: QrCode, badge: 'Napas247' },
    ];

    return (
        <div className="space-y-6 animate-fadeIn pb-16">
            {/* TOAST THÔNG BÁO TỰ ĐỘNG */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-slideInRight ${
                    toast.type === 'success'
                        ? 'bg-emerald-500/95 text-white border-emerald-400 shadow-emerald-500/20'
                        : 'bg-rose-500/95 text-white border-rose-400 shadow-rose-500/20'
                }`}>
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 shrink-0" />
                    )}
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button
                        type="button"
                        onClick={() => setToast(null)}
                        className="ml-2 hover:opacity-75 transition cursor-pointer text-white/80"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* HEADER PHÂN HỆ CÀI ĐẶT HỆ THỐNG */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                                Cài Đặt Hệ Thống
                            </h1>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Quản trị Trung tâm
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Quản lý thông tin thương hiệu, quy định giờ giấc nhận/trả phòng, mức phụ thu, thuế phí và cổng VietQR
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={fetchAllData}
                        disabled={isLoading || isSavingQr || isSavingHotel}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Tải lại toàn bộ dữ liệu cấu hình"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </div>

            {/* HỆ THỐNG TABS ĐIỀU HƯỚNG HIỆN ĐẠI */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-600/20'
                                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                            <span>{tab.label}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {tab.badge}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ======================================================== */}
            {/* TAB 1: THÔNG TIN KHÁCH SẠN & THƯƠNG HIỆU */}
            {/* ======================================================== */}
            {activeTab === 'hotel_info' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
                    <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>Hồ Sơ Thương Hiệu Khách Sạn</span>
                                    {isEditingHotel ? (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                            Đang chỉnh sửa
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                            Chế độ xem
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Thông tin chính thức hiển thị trên Hóa đơn in ấn, Chân trang (Footer) và Email xác nhận
                                </p>
                            </div>
                        </div>

                        {hotelLastUpdated && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Cập nhật gần nhất: <strong className="text-slate-700">{formatDateTime(hotelLastUpdated)}</strong></span>
                            </div>
                        )}
                    </div>

                    <div className="p-6 sm:p-8">
                        {isLoading ? (
                            <div className="py-16 text-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình khách sạn...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitHotel} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* CỘT TRÁI: FORM THÔNG TIN (7 CỘT) */}
                                <div className="lg:col-span-7 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* TÊN KHÁCH SẠN */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Building className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Tên Khách Sạn / Khu Nghỉ Dưỡng</span>
                                                <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={hotelData.hotel_name}
                                                onChange={(e) => setHotelData({ ...hotelData, hotel_name: e.target.value })}
                                                disabled={!isEditingHotel}
                                                required
                                                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed select-none'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* KHẨU HIỆU / SLOGAN */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                <span>Khẩu Hiệu / Slogan</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={hotelData.hotel_slogan}
                                                onChange={(e) => setHotelData({ ...hotelData, hotel_slogan: e.target.value })}
                                                disabled={!isEditingHotel}
                                                placeholder="VD: 5-Star Luxury Resort & Hotel"
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* XẾP HẠNG SAO */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Star className="w-3.5 h-3.5 text-amber-500" />
                                                <span>Tiêu Chuẩn Xếp Hạng</span>
                                            </label>
                                            <select
                                                value={hotelData.stars}
                                                onChange={(e) => setHotelData({ ...hotelData, stars: Number(e.target.value) })}
                                                disabled={!isEditingHotel}
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-semibold transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            >
                                                <option value={3}>⭐⭐⭐ 3 Sao (Standard)</option>
                                                <option value={4}>⭐⭐⭐⭐ 4 Sao (Deluxe)</option>
                                                <option value={5}>⭐⭐⭐⭐⭐ 5 Sao (Luxury Flagship)</option>
                                            </select>
                                        </div>

                                        {/* MÃ SỐ THUẾ (MST) */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Mã Số Thuế (MST Khách sạn)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={hotelData.tax_code}
                                                onChange={(e) => setHotelData({ ...hotelData, tax_code: e.target.value })}
                                                disabled={!isEditingHotel}
                                                placeholder="VD: 0401234567"
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono font-bold transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* HOTLINE LỄ TÂN */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Hotline Tổng Đài Lễ Tân</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={hotelData.hotline}
                                                onChange={(e) => setHotelData({ ...hotelData, hotline: e.target.value })}
                                                disabled={!isEditingHotel}
                                                placeholder="VD: 1900 8899"
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-semibold transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* EMAIL LIÊN HỆ */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Email CSKH / Đặt Phòng</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={hotelData.email}
                                                onChange={(e) => setHotelData({ ...hotelData, email: e.target.value })}
                                                disabled={!isEditingHotel}
                                                placeholder="VD: contact@tahotel.vn"
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* WEBSITE */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Globe className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Website Chính Thức</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={hotelData.website}
                                                onChange={(e) => setHotelData({ ...hotelData, website: e.target.value })}
                                                disabled={!isEditingHotel}
                                                placeholder="VD: https://tahotel.vn"
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* ĐỊA CHỈ TRỤ SỞ */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Địa Chỉ Trụ Sở Khách Sạn</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={hotelData.address}
                                                onChange={(e) => setHotelData({ ...hotelData, address: e.target.value })}
                                                disabled={!isEditingHotel}
                                                placeholder="VD: 08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Ngũ Hành Sơn, Đà Nẵng"
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* MÔ TẢ GIỚI THIỆU */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800">
                                                Giới Thiệu Tổng Quan Thương Hiệu (Hiển thị Footer)
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={hotelData.description}
                                                onChange={(e) => setHotelData({ ...hotelData, description: e.target.value })}
                                                disabled={!isEditingHotel}
                                                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-normal leading-relaxed transition shadow-xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        {/* BỘ NHẬN DIỆN THƯƠNG HIỆU: LOGO & FAVICON */}
                                        <div className="sm:col-span-2 pt-5 border-t border-slate-200 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Palette className="w-4 h-4 text-indigo-600" />
                                                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                                        Bộ Nhận Diện Thương Hiệu (Logo & Favicon)
                                                    </h3>
                                                </div>
                                                <span className="text-[10px] text-slate-500 italic">
                                                    Tự động hiển thị trên Thanh điều hướng, Chân trang, Tab trình duyệt & Hóa đơn in ấn
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* 1. LOGO KHÁCH SẠN */}
                                                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                                                            <span>Logo Khách Sạn</span>
                                                        </label>
                                                        {hotelData.logo_url && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setHotelData({ ...hotelData, logo_url: '' })}
                                                                disabled={!isEditingHotel}
                                                                className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                                                title="Xóa logo hiện tại để dùng lại Monogram mặc định"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                <span>Xóa logo</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Khung xem trước Logo */}
                                                    <div className="h-24 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center p-3 relative overflow-hidden shadow-2xs">
                                                        {hotelData.logo_url ? (
                                                            <img
                                                                src={hotelData.logo_url}
                                                                alt="Logo Khách Sạn"
                                                                className="max-h-full max-w-full object-contain"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center text-slate-400 text-[11px] text-center">
                                                                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-serif font-black text-xs flex items-center justify-center mb-1">
                                                                    TA
                                                                </div>
                                                                <span>Chưa tải logo (đang dùng badge TA mặc định)</span>
                                                            </div>
                                                        )}
                                                        {uploadingField === 'logo_url' && (
                                                            <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-semibold text-blue-600">
                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                                <span>Đang tải logo lên máy chủ...</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Thao tác Upload & Nhập URL */}
                                                    <div className="space-y-2">
                                                        <label className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs ${
                                                            !isEditingHotel
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                : 'bg-white hover:bg-blue-50 text-blue-600 border-blue-200 cursor-pointer active:scale-95'
                                                        }`}>
                                                            <Upload className="w-3.5 h-3.5" />
                                                            <span>Tải ảnh logo từ máy tính</span>
                                                            <input
                                                                type="file"
                                                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                                disabled={!isEditingHotel || uploadingField === 'logo_url'}
                                                                onChange={(e) => {
                                                                    if (e.target.files?.[0]) {
                                                                        handleUploadImage(e.target.files[0], 'logo_url');
                                                                    }
                                                                }}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={hotelData.logo_url || ''}
                                                            onChange={(e) => setHotelData({ ...hotelData, logo_url: e.target.value })}
                                                            disabled={!isEditingHotel}
                                                            placeholder="Hoặc dán trực tiếp URL ảnh logo..."
                                                            className={`w-full px-3 py-1.5 rounded-lg border text-[11px] font-mono transition ${
                                                                !isEditingHotel
                                                                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                                                    : 'bg-white text-slate-800 border-slate-200 focus:outline-hidden focus:border-blue-500'
                                                            }`}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 italic">
                                                        Khuyến nghị: Ảnh PNG nền trong suốt hoặc SVG ngang, chiều cao tối thiểu 80px.
                                                    </p>
                                                </div>

                                                {/* 2. FAVICON TRÌNH DUYỆT */}
                                                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                            <Globe className="w-3.5 h-3.5 text-indigo-600" />
                                                            <span>Favicon Trình Duyệt</span>
                                                        </label>
                                                        {hotelData.favicon_url && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setHotelData({ ...hotelData, favicon_url: '' })}
                                                                disabled={!isEditingHotel}
                                                                className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                                                title="Xóa favicon"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                <span>Xóa icon</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Khung mô phỏng Tab Trình Duyệt Thực Tế */}
                                                    <div className="h-24 rounded-xl border border-slate-200 bg-slate-200/60 p-2 flex items-center justify-center relative overflow-hidden">
                                                        <div className="bg-white rounded-t-xl px-3.5 py-2 shadow-xs border border-slate-300 flex items-center gap-2 max-w-[220px]">
                                                            {hotelData.favicon_url ? (
                                                                <img
                                                                    src={hotelData.favicon_url}
                                                                    alt="Favicon"
                                                                    className="w-4 h-4 object-contain shrink-0"
                                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                                />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
                                                                    TA
                                                                </div>
                                                            )}
                                                            <span className="text-[11px] font-semibold text-slate-800 truncate">
                                                                {hotelData.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 font-bold ml-1">✕</span>
                                                        </div>
                                                        {uploadingField === 'favicon_url' && (
                                                            <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600">
                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                                <span>Đang tải favicon...</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Thao tác Upload & Nhập URL */}
                                                    <div className="space-y-2">
                                                        <label className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs ${
                                                            !isEditingHotel
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                : 'bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-200 cursor-pointer active:scale-95'
                                                        }`}>
                                                            <Upload className="w-3.5 h-3.5" />
                                                            <span>Tải favicon từ máy tính</span>
                                                            <input
                                                                type="file"
                                                                accept="image/x-icon,image/png,image/svg+xml"
                                                                disabled={!isEditingHotel || uploadingField === 'favicon_url'}
                                                                onChange={(e) => {
                                                                    if (e.target.files?.[0]) {
                                                                        handleUploadImage(e.target.files[0], 'favicon_url');
                                                                    }
                                                                }}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={hotelData.favicon_url || ''}
                                                            onChange={(e) => setHotelData({ ...hotelData, favicon_url: e.target.value })}
                                                            disabled={!isEditingHotel}
                                                            placeholder="Hoặc dán trực tiếp URL favicon (.ico, .png)..."
                                                            className={`w-full px-3 py-1.5 rounded-lg border text-[11px] font-mono transition ${
                                                                !isEditingHotel
                                                                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                                                    : 'bg-white text-slate-800 border-slate-200 focus:outline-hidden focus:border-indigo-500'
                                                            }`}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 italic">
                                                        Khuyến nghị: Định dạng .ico hoặc .png kích thước vuông 32x32 hoặc 64x64 pixel.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* NÚT THAO TÁC */}
                                    <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                        {!isEditingHotel ? (
                                            canUpdateSettings ? (
                                                <button
                                                    type="button"
                                                    onClick={handleStartEditHotel}
                                                    disabled={isLoading}
                                                    className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                    <span>Cập nhật thông tin & Logo</span>
                                                </button>
                                            ) : (
                                                <div className="text-xs text-slate-500">Chế độ xem (Chỉ Admin/Owner có quyền sửa)</div>
                                            )
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-3">
                                                <button
                                                    type="submit"
                                                    disabled={isSavingHotel}
                                                    className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    {isSavingHotel ? (
                                                        <>
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                            <span>Đang lưu...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="w-4 h-4" />
                                                            <span>Lưu thông tin & Logo</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEditHotel}
                                                    disabled={isSavingHotel}
                                                    className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <X className="w-4 h-4 text-slate-400" />
                                                    <span>Hủy</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CỘT PHẢI: LIVE PREVIEW THẺ THƯƠNG HIỆU & MẪU IN HÓA ĐƠN (5 CỘT) */}
                                <div className="lg:col-span-5 space-y-4">
                                    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                                        <div className="flex items-center justify-between mb-4">
                                            {hotelData.logo_url ? (
                                                <img
                                                    src={hotelData.logo_url}
                                                    alt="Logo"
                                                    className="h-11 max-w-[150px] object-contain rounded-xl bg-white/10 p-1.5 border border-white/20 shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-serif font-black text-lg shadow-lg">
                                                    TA
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1 text-amber-400">
                                                {Array.from({ length: hotelData.stars || 5 }).map((_, i) => (
                                                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                                                ))}
                                            </div>
                                        </div>

                                        <h3 className="font-serif font-bold text-lg text-white tracking-wide uppercase">
                                            {hotelData.hotel_name || 'Khách Sạn TA'}
                                        </h3>
                                        <p className="text-[11px] text-blue-200/80 font-medium tracking-wider uppercase mt-0.5">
                                            {hotelData.hotel_slogan || 'Luxury Resort & Hotel'}
                                        </p>

                                        <div className="mt-5 space-y-2 text-xs text-slate-300 border-t border-white/10 pt-4">
                                            <p className="flex items-start gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                                <span className="leading-relaxed">{hotelData.address}</span>
                                            </p>
                                            <div className="flex items-center justify-between text-[11px] pt-1">
                                                <span className="flex items-center gap-1 text-slate-300">
                                                    <Phone className="w-3 h-3 text-emerald-400" />
                                                    {hotelData.hotline}
                                                </span>
                                                <span className="flex items-center gap-1 text-slate-300">
                                                    <FileText className="w-3 h-3 text-blue-400" />
                                                    MST: {hotelData.tax_code}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MÔ PHỎNG HEADER HÓA ĐƠN IN ẤN THỰC TẾ */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
                                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-3">
                                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                                            <span>Xem trước đầu trang Hóa đơn in ấn:</span>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-dashed border-slate-300 text-slate-900 shadow-2xs space-y-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {hotelData.logo_url ? (
                                                    <img src={hotelData.logo_url} alt="Logo" className="h-7 w-auto object-contain rounded" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded bg-slate-900 text-white font-serif font-bold text-[10px] flex items-center justify-center">
                                                        TA
                                                    </div>
                                                )}
                                                <p className="font-serif font-black uppercase text-xs tracking-wide">
                                                    {hotelData.hotel_name}
                                                </p>
                                            </div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                                                {hotelData.hotel_slogan}
                                            </p>
                                            <p className="text-[10px] text-slate-600 leading-snug">
                                                Đ/C: {hotelData.address}
                                            </p>
                                            <p className="text-[10px] text-slate-600 font-mono">
                                                Hotline: {hotelData.hotline} | Email: {hotelData.email} | MST: {hotelData.tax_code}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 italic">
                                            * Mọi thay đổi tại tab này sẽ tự động cập nhật ngay trên mẫu in Hóa đơn A4 của khách.
                                        </p>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TAB: QUẢN LÝ BANNER & HÌNH ẢNH CÁC TRANG CÔNG KHAI */}
            {/* ======================================================== */}
            {activeTab === 'page_banners' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn space-y-6">
                    {/* Header Tab Banner */}
                    <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-sky-50/70 via-blue-50/40 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                                <ImageIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>Banner Các Trang Web Công Khai</span>
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                        9 Banner (3 Slide Trang chủ + 6 Trang chuyên mục)
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Tùy biến hình ảnh Hero Banner xuất hiện trên đầu từng trang web của khách hàng. Trang chủ hỗ trợ trọn bộ 3 ảnh Slider chuyển động luân phiên.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleSaveBanners}
                                disabled={isSavingHotel || !canUpdateSettings}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSavingHotel ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Đang lưu...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Lưu thay đổi Banner</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Danh sách 9 Banner Trang (Gồm 3 Slide Trang Chủ + 6 Trang Chuyên Mục) */}
                    <div className="px-6 sm:px-8 pb-8 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {[
                                {
                                    key: 'banner_home',
                                    title: '1. Trang Chủ — Slide 1: Kỳ Nghỉ Thượng Lưu',
                                    badge: 'Trang Chủ • Slide 1',
                                    subtitle: 'Hero Banner chính đầu tiên chào đón khách hàng khi vừa vào website',
                                    previewTag: 'Trang Chủ • Slide 1',
                                    previewTitle: 'Kỳ Nghỉ Thượng Lưu',
                                    previewSub: 'Tại Khách Sạn TA Đà Nẵng',
                                    route: '/',
                                    defaultUrl: DEFAULT_BANNERS.banner_home,
                                },
                                {
                                    key: 'banner_home_2',
                                    title: '2. Trang Chủ — Slide 2: Hồ Bơi Vô Cực Hướng Biển',
                                    badge: 'Trang Chủ • Slide 2',
                                    subtitle: 'Slide thứ 2 giới thiệu hồ bơi chân mây, hoàng hôn Mỹ Khê và thư giãn',
                                    previewTag: 'Trang Chủ • Slide 2',
                                    previewTitle: 'Thiên Đường Nghỉ Dưỡng',
                                    previewSub: 'Hồ Bơi Vô Cực Hướng Biển',
                                    route: '/',
                                    defaultUrl: DEFAULT_BANNERS.banner_home_2,
                                },
                                {
                                    key: 'banner_home_3',
                                    title: '3. Trang Chủ — Slide 3: Phòng Suite Hạng Sang',
                                    badge: 'Trang Chủ • Slide 3',
                                    subtitle: `Slide thứ 3 giới thiệu phòng Suite ${hotelData.stars || 5} sao, ẩm thực thượng hạng và đặc quyền`,
                                    previewTag: 'Trang Chủ • Slide 3',
                                    previewTitle: 'Phòng Suite Hạng Sang',
                                    previewSub: `Đặc Quyền Dịch Vụ ${hotelData.stars || 5} Sao`,
                                    route: '/',
                                    defaultUrl: DEFAULT_BANNERS.banner_home_3,
                                },
                                {
                                    key: 'banner_rooms',
                                    title: '4. Trang Danh Sách Phòng & Suites',
                                    badge: 'Trang Chuyên Mục',
                                    subtitle: 'Banner đầu trang tra cứu phòng trống, bộ lọc tiện nghi và đặt phòng',
                                    previewTag: `Nghỉ Dưỡng ${hotelData.stars || 5} Sao`,
                                    previewTitle: 'Tuyệt Tác Không Gian Nghỉ Dưỡng',
                                    previewSub: 'Bên Bờ Biển Mỹ Khê',
                                    route: '/rooms',
                                    defaultUrl: DEFAULT_BANNERS.banner_rooms,
                                },
                                {
                                    key: 'banner_services',
                                    title: '5. Trang Dịch Vụ & Menu Ẩm Thực (F&B)',
                                    badge: 'Trang Chuyên Mục',
                                    subtitle: 'Banner đầu trang ẩm thực tại phòng, nhà hàng và The Lotus Spa',
                                    previewTag: 'Dịch Vụ Đẳng Cấp',
                                    previewTitle: 'Ẩm Thực Thượng Hạng & Spa',
                                    previewSub: 'Phục Vụ 24/7 Chu Đáo',
                                    route: '/services',
                                    defaultUrl: DEFAULT_BANNERS.banner_services,
                                },
                                {
                                    key: 'banner_corporate',
                                    title: '6. Trang Đặt Đoàn & Doanh Nghiệp (M.I.C.E)',
                                    badge: 'Trang Chuyên Mục',
                                    subtitle: 'Banner dành riêng cho khách đoàn, công ty du lịch và hội nghị',
                                    previewTag: 'B2B & M.I.C.E',
                                    previewTitle: 'Khách Hàng Doanh Nghiệp',
                                    previewSub: '& Đặt Phòng Theo Đoàn',
                                    route: '/corporate-booking',
                                    defaultUrl: DEFAULT_BANNERS.banner_corporate,
                                },
                                {
                                    key: 'banner_news',
                                    title: '7. Trang Tin Tức & Cẩm Nang Du Lịch',
                                    badge: 'Trang Chuyên Mục',
                                    subtitle: 'Banner đầu trang tin tức, sự kiện và cẩm nang khám phá',
                                    previewTag: 'Tin Tức & Cẩm Nang',
                                    previewTitle: 'Khám Phá Đà Nẵng Diệu Kỳ',
                                    previewSub: 'Cẩm Nang Du Lịch & Ẩm Thực',
                                    route: '/news',
                                    defaultUrl: DEFAULT_BANNERS.banner_news,
                                },
                                {
                                    key: 'banner_promotions',
                                    title: '8. Trang Khuyến Mãi & Ưu Đãi',
                                    badge: 'Trang Chuyên Mục',
                                    subtitle: 'Banner giới thiệu ưu đãi mùa hè, voucher và đặc quyền hội viên',
                                    previewTag: 'Ưu Đãi Đặc Quyền',
                                    previewTitle: 'Chương Trình Khuyến Mãi',
                                    previewSub: 'Dành Riêng Cho Đặt Trực Tuyến',
                                    route: '/promotions',
                                    defaultUrl: DEFAULT_BANNERS.banner_promotions,
                                },
                                {
                                    key: 'banner_contact',
                                    title: '9. Trang Liên Hệ & Chăm Sóc Khách Hàng',
                                    badge: 'Trang Chuyên Mục',
                                    subtitle: 'Banner đầu trang thông tin liên hệ, hotline và địa chỉ bản đồ',
                                    previewTag: 'Hỗ Trợ 24/7',
                                    previewTitle: 'Kết Nối Với Chúng Tôi',
                                    previewSub: 'Khách Sạn TA Đà Nẵng',
                                    route: '/contact',
                                    defaultUrl: DEFAULT_BANNERS.banner_contact,
                                },
                            ].map((page) => {
                                const currentUrl = hotelData[page.key] || page.defaultUrl;
                                const isCustom = Boolean(hotelData[page.key] && hotelData[page.key] !== page.defaultUrl);
                                const isUploading = uploadingField === page.key;

                                return (
                                    <div
                                        key={page.key}
                                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                                    >
                                        {/* Card Title & Badges */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                                    <span>{page.title}</span>
                                                    {page.badge && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                            {page.badge}
                                                        </span>
                                                    )}
                                                    {isCustom ? (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Ảnh tùy chỉnh
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                            Ảnh mặc định
                                                        </span>
                                                    )}
                                                </h3>
                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                    {page.subtitle}
                                                </p>
                                            </div>

                                            <a
                                                href={page.route}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="shrink-0 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="Mở xem trang thực tế trong tab mới"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>

                                        {/* Khung Xem Trước Hero Banner Giống Thực Tế */}
                                        <div className="relative rounded-xl overflow-hidden aspect-[21/9] bg-slate-900 border border-slate-200/80 shadow-inner group">
                                            <img
                                                src={currentUrl}
                                                alt={page.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                onError={(e) => {
                                                    e.target.src = page.defaultUrl;
                                                }}
                                            />
                                            {/* Gradient Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent pointer-events-none" />

                                            {/* Mock text overlay */}
                                            <div className="absolute inset-0 p-4 flex flex-col justify-end text-white pointer-events-none">
                                                <span className="text-[9px] font-bold tracking-widest uppercase text-amber-300">
                                                    {page.previewTag}
                                                </span>
                                                <h4 className="font-serif font-bold text-xs sm:text-sm text-white drop-shadow-xs line-clamp-1">
                                                    {page.previewTitle}
                                                </h4>
                                                <p className="text-[10px] text-gray-200 line-clamp-1">
                                                    {page.previewSub}
                                                </p>
                                            </div>

                                            {/* Overlay khi đang tải ảnh lên */}
                                            {isUploading && (
                                                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-semibold">
                                                    <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                                                    <span>Đang tải ảnh lên...</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Thanh công cụ Tải ảnh & Khôi phục */}
                                        <div className="space-y-2 pt-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <label className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs ${
                                                    !canUpdateSettings
                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white hover:bg-blue-50 text-blue-600 border-blue-200 cursor-pointer active:scale-95'
                                                }`}>
                                                    <Upload className="w-3.5 h-3.5" />
                                                    <span>Tải ảnh từ máy tính</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        disabled={!canUpdateSettings || isUploading}
                                                        onChange={(e) => {
                                                            if (e.target.files?.[0]) {
                                                                handleUploadImage(e.target.files[0], page.key);
                                                            }
                                                        }}
                                                        className="hidden"
                                                    />
                                                </label>

                                                {isCustom && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setHotelData({ ...hotelData, [page.key]: page.defaultUrl })}
                                                        disabled={!canUpdateSettings}
                                                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                        title="Khôi phục ảnh mẫu ban đầu"
                                                    >
                                                        <RotateCcw className="w-3 h-3 text-slate-400" />
                                                        <span>Ảnh mẫu</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Ô nhập link URL ảnh trực tiếp */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-slate-500">
                                                    Đường dẫn URL ảnh:
                                                </label>
                                                <input
                                                    type="text"
                                                    value={hotelData[page.key] || ''}
                                                    onChange={(e) => setHotelData({ ...hotelData, [page.key]: e.target.value })}
                                                    disabled={!canUpdateSettings}
                                                    placeholder={page.defaultUrl}
                                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">Lưu ý:</span> Khuyến nghị ảnh có độ phân giải từ <strong className="text-slate-800">1920x800px</strong> trở lên để hiển thị sắc nét nhất trên màn hình lớn.
                            </div>
                          
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TAB: QUY ĐỊNH GIỜ NHẬN / TRẢ PHÒNG & PHỤ THU */}
            {/* ======================================================== */}
            {activeTab === 'checkin_checkout' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
                    <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>Quy Định Giờ Giấc & Phụ Thu Quá Giờ</span>
                                    {isEditingHotel ? (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                            Đang chỉnh sửa
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                            Chế độ xem
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Khung giờ nhận/trả phòng tiêu chuẩn và tỷ lệ % phụ thu khi khách check-in sớm hoặc check-out muộn
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8">
                        {isLoading ? (
                            <div className="py-16 text-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitHotel} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* CỘT TRÁI: FORM CẤU HÌNH (7 CỘT) */}
                                <div className="lg:col-span-7 space-y-6">
                                    {/* 1. KHUNG GIỜ TIÊU CHUẨN */}
                                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4 text-blue-600" />
                                            <span>Khung Giờ Nhận & Trả Phòng Chuẩn</span>
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200">
                                                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                                    <span>Giờ Check-in tiêu chuẩn</span>
                                                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Mặc định 14:00</span>
                                                </label>
                                                <input
                                                    type="time"
                                                    value={hotelData.check_in_time || '14:00'}
                                                    onChange={(e) => setHotelData({ ...hotelData, check_in_time: e.target.value })}
                                                    disabled={!isEditingHotel}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold font-mono text-slate-900"
                                                />
                                            </div>
                                            <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200">
                                                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                                    <span>Giờ Check-out tiêu chuẩn</span>
                                                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Mặc định 12:00</span>
                                                </label>
                                                <input
                                                    type="time"
                                                    value={hotelData.check_out_time || '12:00'}
                                                    onChange={(e) => setHotelData({ ...hotelData, check_out_time: e.target.value })}
                                                    disabled={!isEditingHotel}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold font-mono text-slate-900"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. BẢNG PHỤ THU CHECK-IN SỚM */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                                            <span>Mức Phụ Thu Nhận Phòng Sớm (Early Check-in)</span>
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                                <div className="text-xs">
                                                    <strong className="text-slate-800 block">Trước 06:00 sáng</strong>
                                                    <span className="text-slate-500 text-[11px]">Nhận phòng vào ban đêm</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={200}
                                                        value={hotelData.early_checkin_before_6am}
                                                        onChange={(e) => setHotelData({ ...hotelData, early_checkin_before_6am: Number(e.target.value) })}
                                                        disabled={!isEditingHotel}
                                                        className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">%</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                                <div className="text-xs">
                                                    <strong className="text-slate-800 block">Từ 06:00 - 09:00 sáng</strong>
                                                    <span className="text-slate-500 text-[11px]">Nhận phòng sáng sớm</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={200}
                                                        value={hotelData.early_checkin_6am_9am}
                                                        onChange={(e) => setHotelData({ ...hotelData, early_checkin_6am_9am: Number(e.target.value) })}
                                                        disabled={!isEditingHotel}
                                                        className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">%</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                                <div className="text-xs">
                                                    <strong className="text-slate-800 block">Từ 09:00 - 14:00 trưa</strong>
                                                    <span className="text-slate-500 text-[11px]">Nhận phòng trước giờ chuẩn</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={200}
                                                        value={hotelData.early_checkin_9am_12pm}
                                                        onChange={(e) => setHotelData({ ...hotelData, early_checkin_9am_12pm: Number(e.target.value) })}
                                                        disabled={!isEditingHotel}
                                                        className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. BẢNG PHỤ THU CHECK-OUT MUỘN */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <ArrowUpRight className="w-4 h-4 text-amber-600" />
                                            <span>Mức Phụ Thu Trả Phòng Muộn (Late Check-out)</span>
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                                <div className="text-xs">
                                                    <strong className="text-slate-800 block">Từ 12:00 - 15:00 chiều</strong>
                                                    <span className="text-slate-500 text-[11px]">Trễ dưới 3 tiếng</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={200}
                                                        value={hotelData.late_checkout_12pm_3pm}
                                                        onChange={(e) => setHotelData({ ...hotelData, late_checkout_12pm_3pm: Number(e.target.value) })}
                                                        disabled={!isEditingHotel}
                                                        className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">%</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                                <div className="text-xs">
                                                    <strong className="text-slate-800 block">Từ 15:00 - 18:00 chiều</strong>
                                                    <span className="text-slate-500 text-[11px]">Trễ bán ngày</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={200}
                                                        value={hotelData.late_checkout_3pm_6pm}
                                                        onChange={(e) => setHotelData({ ...hotelData, late_checkout_3pm_6pm: Number(e.target.value) })}
                                                        disabled={!isEditingHotel}
                                                        className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">%</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                                <div className="text-xs">
                                                    <strong className="text-slate-800 block">Sau 18:00 tối</strong>
                                                    <span className="text-slate-500 text-[11px]">Tính trọn tiền phòng 1 đêm</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={200}
                                                        value={hotelData.late_checkout_after_6pm}
                                                        onChange={(e) => setHotelData({ ...hotelData, late_checkout_after_6pm: Number(e.target.value) })}
                                                        disabled={!isEditingHotel}
                                                        className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* NÚT LƯU CẤU HÌNH */}
                                    <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                        {!isEditingHotel ? (
                                            canUpdateSettings ? (
                                                <button
                                                    type="button"
                                                    onClick={handleStartEditHotel}
                                                    disabled={isLoading}
                                                    className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                    <span>Cập nhật giờ giấc & phụ thu</span>
                                                </button>
                                            ) : (
                                                <div className="text-xs text-slate-500">Chế độ xem</div>
                                            )
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="submit"
                                                    disabled={isSavingHotel}
                                                    className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    <span>Lưu quy định</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEditHotel}
                                                    className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CỘT PHẢI: LIVE SURCHARGE SIMULATOR (5 CỘT) */}
                                <div className="lg:col-span-5 bg-gradient-to-b from-indigo-50/70 via-white to-slate-50 rounded-3xl p-6 border border-indigo-100 shadow-sm space-y-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                                            <Calculator className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                                                Bộ Tính Thử Phụ Thu (Live Simulator)
                                            </h4>
                                            <p className="text-[11px] text-slate-500">Thử nghiệm công thức tính phụ thu tự động</p>
                                        </div>
                                    </div>

                                    {/* Input giả lập */}
                                    <div className="space-y-3 bg-white p-4 rounded-2xl border border-indigo-100 text-xs">
                                        <div>
                                            <label className="block text-slate-600 font-medium mb-1">Loại tình huống:</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => { setSimType('late_checkout'); setSimHour('14:30'); }}
                                                    className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                                                        simType === 'late_checkout'
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                            : 'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}
                                                >
                                                    Check-out Muộn
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSimType('early_checkin'); setSimHour('07:30'); }}
                                                    className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                                                        simType === 'early_checkin'
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                            : 'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}
                                                >
                                                    Check-in Sớm
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-slate-600 font-medium mb-1">Giờ khách thực tế:</label>
                                                <input
                                                    type="time"
                                                    value={simHour}
                                                    onChange={(e) => setSimHour(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold font-mono text-slate-900"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-slate-600 font-medium mb-1">Giá phòng 1 đêm:</label>
                                                <input
                                                    type="number"
                                                    step={100000}
                                                    value={simRoomRate}
                                                    onChange={(e) => setSimRoomRate(Number(e.target.value))}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* KẾT QUẢ MÔ PHỎNG */}
                                    <div className="bg-white rounded-2xl p-5 border border-indigo-200/80 shadow-xs space-y-3">
                                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                            <span className="text-slate-500">Khung giờ áp dụng:</span>
                                            <strong className="text-indigo-700 font-semibold">{simResult.rule}</strong>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                            <span className="text-slate-500">Tỷ lệ phụ thu:</span>
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                                                +{simResult.percent}%
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-xs font-bold text-slate-700">Tiền phụ thu tự động:</span>
                                            <strong className="text-base font-black text-rose-600 font-mono">
                                                +{Number(simResult.amount).toLocaleString('vi-VN')}đ
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-blue-50/70 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                        <span>Quy chuẩn phụ thu này giúp Lễ tân tự động tính toán phụ thu chính xác trong Modal Check-in và Check-out mà không cần tính nhẩm.</span>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: CHÍNH SÁCH THUẾ VAT, DỊCH VỤ & ĐẶT CỌC */}
            {/* ======================================================== */}
            {activeTab === 'policies' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
                    <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                                <Percent className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>Chính Sách Thuế VAT, Phí Dịch Vụ & Đặt Cọc</span>
                                    {isEditingHotel ? (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                            Đang chỉnh sửa
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                            Chế độ xem
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Các thông số tài chính áp dụng cho Hóa đơn thanh toán, đơn đặt đoàn và điều khoản hủy phòng
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8">
                        {isLoading ? (
                            <div className="py-16 text-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitHotel} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* CỘT TRÁI: FORM CHÍNH SÁCH (7 CỘT) */}
                                <div className="lg:col-span-7 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* THUẾ VAT */}
                                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-800">Thuế GTGT / VAT (%)</label>
                                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Theo luật Thuế</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={30}
                                                    step={0.5}
                                                    value={hotelData.vat_percent}
                                                    onChange={(e) => setHotelData({ ...hotelData, vat_percent: Number(e.target.value) })}
                                                    disabled={!isEditingHotel}
                                                    className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                                />
                                                <span className="font-bold text-slate-500 text-sm">%</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">Hiện tại theo chính sách thuế là 8% hoặc 10%.</p>
                                        </div>

                                        {/* PHÍ PHỤC VỤ (SERVICE CHARGE) */}
                                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-800">Phí Phục Vụ (Service %)</label>
                                                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold">Chuẩn {hotelData.stars || 5} Sao</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={20}
                                                    step={0.5}
                                                    value={hotelData.service_charge_percent}
                                                    onChange={(e) => setHotelData({ ...hotelData, service_charge_percent: Number(e.target.value) })}
                                                    disabled={!isEditingHotel}
                                                    className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                                />
                                                <span className="font-bold text-slate-500 text-sm">%</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">Phí phục vụ khách sạn {hotelData.stars || 5} sao thông thường là {hotelData.service_charge_percent}%.</p>
                                        </div>

                                        {/* TỶ LỆ CỌC ĐOÀN */}
                                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-800">Tỷ Lệ Cọc Đặt Đoàn (%)</label>
                                                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold">Khách đoàn B2B</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={10}
                                                    max={100}
                                                    value={hotelData.group_deposit_percent}
                                                    onChange={(e) => setHotelData({ ...hotelData, group_deposit_percent: Number(e.target.value) })}
                                                    disabled={!isEditingHotel}
                                                    className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                                />
                                                <span className="font-bold text-slate-500 text-sm">%</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">Mức tiền cọc tối thiểu để chốt giữ chỗ đoàn (Thường 50%).</p>
                                        </div>

                                        {/* THỜI GIAN GIỮ PHÒNG CHỜ THANH TOÁN */}
                                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-800">Hạn Giữ Chỗ Tự Động</label>
                                                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold">Timeout</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={5}
                                                    max={120}
                                                    value={hotelData.auto_cancel_minutes}
                                                    onChange={(e) => setHotelData({ ...hotelData, auto_cancel_minutes: Number(e.target.value) })}
                                                    disabled={!isEditingHotel}
                                                    className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                                />
                                                <span className="text-xs font-bold text-slate-500 shrink-0">Phút</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">Hủy đơn tự động nếu khách không quét mã VietQR thanh toán.</p>
                                        </div>

                                        {/* HỦY PHÒNG MIỄN PHÍ TRƯỚC (GIỜ) */}
                                        <div className="sm:col-span-2 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-800">Thời Hạn Hủy Phòng Miễn Phí (Cancellation Policy)</label>
                                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Chính sách linh hoạt</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={12}
                                                    max={168}
                                                    value={hotelData.cancellation_free_hours}
                                                    onChange={(e) => setHotelData({ ...hotelData, cancellation_free_hours: Number(e.target.value) })}
                                                    disabled={!isEditingHotel}
                                                    className="w-32 px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                                />
                                                <span className="text-xs font-bold text-slate-500">Giờ trước ngày nhận phòng (VD: 48 giờ = 2 ngày)</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">Sau thời gian này nếu khách hủy đơn sẽ bị tính phí cọc đêm đầu tiên.</p>
                                        </div>
                                    </div>

                                    {/* NÚT LƯU */}
                                    <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                        {!isEditingHotel ? (
                                            canUpdateSettings ? (
                                                <button
                                                    type="button"
                                                    onClick={handleStartEditHotel}
                                                    disabled={isLoading}
                                                    className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                    <span>Cập nhật chính sách thuế & cọc</span>
                                                </button>
                                            ) : (
                                                <div className="text-xs text-slate-500">Chế độ xem</div>
                                            )
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="submit"
                                                    disabled={isSavingHotel}
                                                    className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    <span>Lưu chính sách</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEditHotel}
                                                    className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CỘT PHẢI: TỔNG QUAN TÀI CHÍNH MẪU (5 CỘT) */}
                                <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 space-y-4">
                                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-emerald-600" />
                                        <span>Cơ Cấu Giá Hóa Đơn Chuẩn (Mô Phỏng 2,000,000đ)</span>
                                    </h4>

                                    <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <span className="text-slate-500">Tiền phòng thuần:</span>
                                            <strong className="text-slate-900 font-mono">2,000,000đ</strong>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <span className="text-slate-500">Phí phục vụ ({hotelData.service_charge_percent}%):</span>
                                            <span className="text-slate-700 font-mono">
                                                +{((2000000 * (hotelData.service_charge_percent || 0)) / 100).toLocaleString('vi-VN')}đ
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <span className="text-slate-500">Thuế GTGT / VAT ({hotelData.vat_percent}%):</span>
                                            <span className="text-slate-700 font-mono">
                                                +{((2000000 * (hotelData.vat_percent || 0)) / 100).toLocaleString('vi-VN')}đ
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="font-bold text-slate-900">Tổng thanh toán:</span>
                                            <strong className="text-sm font-black text-emerald-700 font-mono">
                                                {(2000000 + (2000000 * (hotelData.service_charge_percent || 0)) / 100 + (2000000 * (hotelData.vat_percent || 0)) / 100).toLocaleString('vi-VN')}đ
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                                        <p className="font-bold">Đơn Đoàn Master (Corporate Booking):</p>
                                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                                            Với mức cọc <strong>{hotelData.group_deposit_percent}%</strong>, doanh nghiệp sẽ quét mã VietQR đặt cọc trước một nửa để giữ phòng, số còn lại quyết toán khi Check-out.
                                        </p>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: CẤU HÌNH THANH TOÁN VIETQR */}
            {/* ======================================================== */}
            {activeTab === 'vietqr' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
                    <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                                <QrCode className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>Cấu hình Thanh toán VietQR (Napas247)</span>
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                        Động (Dynamic)
                                    </span>
                                    {isEditingQr ? (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                            Đang chỉnh sửa
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                            Chế độ xem
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Thông tin tài khoản thụ hưởng nhận tiền chuyển khoản đặt phòng tự động
                                </p>
                            </div>
                        </div>

                        {qrLastUpdated && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Cập nhật gần nhất: <strong className="text-slate-700">{formatDateTime(qrLastUpdated)}</strong></span>
                            </div>
                        )}
                    </div>

                    <div className="p-6 sm:p-8">
                        {isLoading ? (
                            <div className="py-16 text-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình thanh toán...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitQr} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* CỘT TRÁI: FORM 3 INPUT CHÍNH (7 CỘT) */}
                                <div className="lg:col-span-7 space-y-5">
                                    {/* Hướng dẫn & Lưu ý */}
                                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 flex items-start gap-3">
                                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-blue-950">
                                                Nguyên lý hoạt động mã QR động:
                                            </p>
                                            <p className="text-blue-800 leading-relaxed">
                                                {isEditingQr ? (
                                                    <span>Bạn đang ở chế độ chỉnh sửa. Thay đổi số tài khoản hoặc ngân hàng bên dưới rồi bấm <strong>&ldquo;Lưu cấu hình&rdquo;</strong> để áp dụng ngay.</span>
                                                ) : (
                                                    <span>Hệ thống đang ở chế độ xem an toàn. Bấm <strong>&ldquo;Cập nhật&rdquo;</strong> bên dưới để chỉnh sửa thông tin tài khoản thụ hưởng.</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Gợi ý chọn nhanh ngân hàng phổ biến */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                            <span>Chọn nhanh ngân hàng phổ biến:</span>
                                            {!isEditingQr && (
                                                <span className="text-[10px] text-slate-400 font-normal italic">
                                                    (Bấm &ldquo;Cập nhật&rdquo; để chọn)
                                                </span>
                                            )}
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {POPULAR_BANKS.slice(0, 6).map((b) => {
                                                const isSelected = qrFormData.bank_bin === b.bin;
                                                return (
                                                    <button
                                                        key={b.bin}
                                                        type="button"
                                                        onClick={() => handleSelectBank(b.bin)}
                                                        disabled={!isEditingQr}
                                                        className={`px-3 py-2 rounded-xl text-left border text-xs font-semibold transition flex items-center justify-between ${
                                                            !isEditingQr
                                                                ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-500'
                                                                : isSelected
                                                                    ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-xs ring-1 ring-blue-600/20 cursor-pointer'
                                                                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 cursor-pointer'
                                                        }`}
                                                    >
                                                        <span className="truncate">{b.shortName}</span>
                                                        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-1">
                                                            {b.bin}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* INPUT 1: MÃ BIN NGÂN HÀNG */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="bank_bin" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Mã BIN Ngân Hàng</span>
                                                <span className="text-rose-500">*</span>
                                            </label>
                                            {currentBank && (
                                                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                    ✓ {currentBank.shortName} ({currentBank.fullName})
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            id="bank_bin"
                                            type="text"
                                            value={qrFormData.bank_bin}
                                            onChange={(e) => setQrFormData({ ...qrFormData, bank_bin: e.target.value })}
                                            placeholder="Ví dụ: 970422 (MB Bank), 970436 (VCB)..."
                                            disabled={!isEditingQr}
                                            required
                                            className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-medium transition shadow-xs ${
                                                !isEditingQr
                                                    ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                            }`}
                                        />
                                    </div>

                                    {/* INPUT 2: SỐ TÀI KHOẢN */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="account_no" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Số Tài Khoản Thụ Hưởng</span>
                                                <span className="text-rose-500">*</span>
                                            </label>
                                            {qrFormData.account_no && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(qrFormData.account_no, 'account_no')}
                                                    className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
                                                >
                                                    {copiedField === 'account_no' ? (
                                                        <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                                                            <Check className="w-3 h-3" /> Đã sao chép
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3" /> Sao chép
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            id="account_no"
                                            type="text"
                                            value={qrFormData.account_no}
                                            onChange={(e) => setQrFormData({ ...qrFormData, account_no: e.target.value.replace(/\s+/g, '') })}
                                            placeholder="Ví dụ: 123456789, 0905123456..."
                                            disabled={!isEditingQr}
                                            required
                                            className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold tracking-wider transition shadow-xs ${
                                                !isEditingQr
                                                    ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                            }`}
                                        />
                                    </div>

                                    {/* INPUT 3: TÊN CHỦ TÀI KHOẢN */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="account_name" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Tên Chủ Tài Khoản (In hoa không dấu)</span>
                                                <span className="text-rose-500">*</span>
                                            </label>
                                            {qrFormData.account_name && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(qrFormData.account_name, 'account_name')}
                                                    className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
                                                >
                                                    {copiedField === 'account_name' ? (
                                                        <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                                                            <Check className="w-3 h-3" /> Đã sao chép
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3" /> Sao chép
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            id="account_name"
                                            type="text"
                                            value={qrFormData.account_name}
                                            onChange={(e) => setQrFormData({ ...qrFormData, account_name: e.target.value.toUpperCase() })}
                                            placeholder="Ví dụ: KHACH SAN TA DA NANG, NGUYEN VAN A..."
                                            disabled={!isEditingQr}
                                            required
                                            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold uppercase tracking-wide transition shadow-xs ${
                                                !isEditingQr
                                                    ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                            }`}
                                        />
                                    </div>

                                    {/* NÚT THAO TÁC */}
                                    <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                        {!isEditingQr ? (
                                            canUpdateSettings ? (
                                                <button
                                                    type="button"
                                                    onClick={handleStartEditQr}
                                                    disabled={isLoading}
                                                    className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                    <span>Cập nhật cấu hình</span>
                                                </button>
                                            ) : (
                                                <div className="text-xs text-slate-500">Chế độ xem</div>
                                            )
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-3">
                                                <button
                                                    type="submit"
                                                    disabled={isSavingQr}
                                                    className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                                >
                                                    {isSavingQr ? (
                                                        <>
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                            <span>Đang lưu...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="w-4 h-4" />
                                                            <span>Lưu cấu hình</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEditQr}
                                                    disabled={isSavingQr}
                                                    className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <X className="w-4 h-4 text-slate-400" />
                                                    <span>Hủy</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CỘT PHẢI: LIVE PREVIEW QR (5 CỘT) */}
                                <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 flex flex-col items-center text-center">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs mb-4">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Xem trước mã VietQR khách hàng sẽ thấy
                                    </div>

                                    <div className="relative p-2.5 bg-white rounded-2xl border-2 border-dashed border-blue-400 shadow-md max-w-[240px] w-full aspect-square flex items-center justify-center overflow-hidden">
                                        {previewQrUrl ? (
                                            <img
                                                src={previewQrUrl}
                                                alt="Preview VietQR"
                                                className="w-full h-full object-contain rounded-xl"
                                            />
                                        ) : (
                                            <div className="text-xs text-slate-400 flex flex-col items-center gap-2">
                                                <QrCode className="w-8 h-8 text-slate-300" />
                                                <span>Nhập đủ thông tin để tạo mã</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full mt-4 bg-white rounded-2xl p-4 border border-slate-200/70 text-left space-y-2 text-xs">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <span className="text-slate-500">Ngân hàng:</span>
                                            <strong className="text-slate-900 font-semibold truncate max-w-[170px]">
                                                {currentBank?.shortName || qrFormData.bank_bin || '—'}
                                            </strong>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <span className="text-slate-500">Số tài khoản:</span>
                                            <span className="font-mono font-bold text-slate-900">
                                                {qrFormData.account_no || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Chủ tài khoản:</span>
                                            <strong className="text-slate-900 font-bold uppercase truncate max-w-[170px]">
                                                {qrFormData.account_name || '—'}
                                            </strong>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                        <span>Mã QR trên tự động làm mới khi bạn gõ phím.</span>
                                    </p>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
