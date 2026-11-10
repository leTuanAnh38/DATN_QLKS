import React, { useState, useEffect } from 'react';
import {
    QrCode,
    Building2,
    CheckCircle2,
    AlertCircle,
    Info,
    Clock,
    Percent,
    Image as ImageIcon
} from 'lucide-react';
import api from '../../../services/api';
import { useHasPermission } from '../../../utils/permission';
import { hotelSettingStore, DEFAULT_BANNERS } from '../../../store/hotelSettingStore';
import { POPULAR_BANKS } from '../../../utils/constants';
import {
    HotelInfoTab,
    BannersTab,
    CheckInOutRulesTab,
    PoliciesTab,
    VietQrTab
} from '../../../components/admin/settings';

export default function SystemSettings() {
    const canUpdateSettings = useHasPermission('settings', 'update');

    // TAB ĐIỀU HƯỚNG HIỆN TẠI
    const [activeTab, setActiveTab] = useState('hotel_info'); // 'hotel_info' | 'page_banners' | 'checkin_checkout' | 'policies' | 'vietqr'

    // ==========================================
    // 1. STATE CHO VIETQR
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
    // 2. STATE CHO KHÁCH SẠN & VẬN HÀNH
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
        banner_login: DEFAULT_BANNERS.banner_login,
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
    // 3. STATE CHUNG: LOADING, TOAST & UPLOADING
    // ==========================================
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [copiedField, setCopiedField] = useState(null);
    const [uploadingField, setUploadingField] = useState(null);

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
                banner_login: hotelData.banner_login || DEFAULT_BANNERS.banner_login,
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

    // Preview URL VietQR Napas247 demo
    const demoAmount = 100000;
    const demoContent = `DAT PHONG ${hotelData.hotel_name || 'KHACH SAN'}`.slice(0, 30);
    const previewQrUrl = qrFormData.bank_bin && qrFormData.account_no
        ? `https://img.vietqr.io/image/${qrFormData.bank_bin}-${qrFormData.account_no}-compact2.jpg?amount=${demoAmount}&addInfo=${encodeURIComponent(demoContent)}&accountName=${encodeURIComponent(qrFormData.account_name)}`
        : '';

    // CẤU HÌNH DANH SÁCH CÁC TAB
    const SETTING_TABS = [
        {
            id: 'hotel_info',
            label: 'Hồ Sơ Khách Sạn & Logo',
            desc: 'Tên, sao, hotline, email, logo & favicon',
            icon: Building2,
            badge: 'Cơ bản'
        },
        {
            id: 'page_banners',
            label: 'Banner Các Trang Web',
            desc: '10 Hero banner cho trang chủ và các trang công khai',
            icon: ImageIcon,
            badge: 'Hình ảnh'
        },
        {
            id: 'checkin_checkout',
            label: 'Giờ Giấc & Phụ Thu',
            desc: 'Khung giờ nhận/trả và % phụ thu sớm/muộn',
            icon: Clock,
            badge: 'Vận hành'
        },
        {
            id: 'policies',
            label: 'Thuế VAT, Dịch Vụ & Cọc',
            desc: 'Tỷ lệ % VAT, phí dịch vụ, cọc đoàn và hủy phòng',
            icon: Percent,
            badge: 'Tài chính'
        },
        {
            id: 'vietqr',
            label: 'Thanh Toán VietQR',
            desc: 'Mã BIN ngân hàng, số tài khoản & mã QR động',
            icon: QrCode,
            badge: 'Cổng TT'
        }
    ];

    return (
        <div className="space-y-6">
            {/* TOAST THÔNG BÁO NỔI */}
            {toast && (
                <div
                    className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold transition-all duration-300 animate-slideDown ${
                        toast.type === 'success'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                            : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
                    }`}
                >
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 shrink-0" />
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* HEADER TIÊU ĐỀ TRANG CÀI ĐẶT */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <span>Cài Đặt Hệ Thống & Vận Hành PMS</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Trung tâm cấu hình toàn diện thông tin thương hiệu, quy định vận hành, chính sách tài chính và cổng thanh toán
                    </p>
                </div>
            </div>

            {/* TAB NAVIGATION TẬP TRUNG */}
            <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {SETTING_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex flex-col text-left p-3 rounded-xl transition-all cursor-pointer relative ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-600/20'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full mb-1">
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    isActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {tab.badge}
                                </span>
                            </div>
                            <span className="text-xs font-bold leading-tight line-clamp-1">{tab.label}</span>
                            <span className={`text-[10px] mt-0.5 line-clamp-1 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                                {tab.desc}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: THÔNG TIN KHÁCH SẠN & BỘ NHẬN DIỆN */}
            {activeTab === 'hotel_info' && (
                <HotelInfoTab
                    hotelData={hotelData}
                    setHotelData={setHotelData}
                    isEditingHotel={isEditingHotel}
                    isSavingHotel={isSavingHotel}
                    isLoading={isLoading}
                    hotelLastUpdated={hotelLastUpdated}
                    canUpdateSettings={canUpdateSettings}
                    uploadingField={uploadingField}
                    onStartEdit={handleStartEditHotel}
                    onCancelEdit={handleCancelEditHotel}
                    onSubmit={handleSubmitHotel}
                    onUploadImage={handleUploadImage}
                />
            )}

            {/* TAB 2: QUẢN LÝ BANNER & HÌNH ẢNH */}
            {activeTab === 'page_banners' && (
                <BannersTab
                    hotelData={hotelData}
                    setHotelData={setHotelData}
                    isSavingHotel={isSavingHotel}
                    canUpdateSettings={canUpdateSettings}
                    uploadingField={uploadingField}
                    onSaveBanners={handleSaveBanners}
                    onUploadImage={handleUploadImage}
                />
            )}

            {/* TAB 3: QUY ĐỊNH GIỜ GIẤC & PHỤ THU */}
            {activeTab === 'checkin_checkout' && (
                <CheckInOutRulesTab
                    hotelData={hotelData}
                    setHotelData={setHotelData}
                    isEditingHotel={isEditingHotel}
                    isSavingHotel={isSavingHotel}
                    isLoading={isLoading}
                    canUpdateSettings={canUpdateSettings}
                    onStartEdit={handleStartEditHotel}
                    onCancelEdit={handleCancelEditHotel}
                    onSubmit={handleSubmitHotel}
                />
            )}

            {/* TAB 4: CHÍNH SÁCH THUẾ VAT, DỊCH VỤ & CỌC */}
            {activeTab === 'policies' && (
                <PoliciesTab
                    hotelData={hotelData}
                    setHotelData={setHotelData}
                    isEditingHotel={isEditingHotel}
                    isSavingHotel={isSavingHotel}
                    isLoading={isLoading}
                    canUpdateSettings={canUpdateSettings}
                    onStartEdit={handleStartEditHotel}
                    onCancelEdit={handleCancelEditHotel}
                    onSubmit={handleSubmitHotel}
                />
            )}

            {/* TAB 5: CẤU HÌNH THANH TOÁN VIETQR */}
            {activeTab === 'vietqr' && (
                <VietQrTab
                    qrFormData={qrFormData}
                    setQrFormData={setQrFormData}
                    isEditingQr={isEditingQr}
                    isSavingQr={isSavingQr}
                    isLoading={isLoading}
                    qrLastUpdated={qrLastUpdated}
                    canUpdateSettings={canUpdateSettings}
                    onStartEdit={handleStartEditQr}
                    onCancelEdit={handleCancelEditQr}
                    onSubmit={handleSubmitQr}
                    onSelectBank={handleSelectBank}
                    onCopy={handleCopy}
                    copiedField={copiedField}
                    previewQrUrl={previewQrUrl}
                    currentBank={currentBank}
                />
            )}
        </div>
    );
}
