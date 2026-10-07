import React, { useState, useEffect } from 'react';
import {
    Settings,
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
    ExternalLink,
    HelpCircle,
    Edit3,
    X
} from 'lucide-react';
import api from '../../services/api';

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
    // 1. STATE FORM CẤU HÌNH THANH TOÁN
    const [formData, setFormData] = useState({
        bank_bin: '',
        account_no: '',
        account_name: ''
    });

    // Dữ liệu đã lưu ban đầu để khôi phục khi ấn "Hủy thay đổi"
    const [savedData, setSavedData] = useState({
        bank_bin: '',
        account_no: '',
        account_name: ''
    });

    // 2. STATE CHẾ ĐỘ CHỈNH SỬA (Mặc định là false - Chế độ xem)
    const [isEditing, setIsEditing] = useState(false);

    // 3. STATE TRẠNG THÁI HỆ THỐNG
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
    const [copiedField, setCopiedField] = useState(null);

    // Hiển thị Toast thông báo tự ẩn sau 4 giây
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // 4. FETCH DỮ LIỆU CẤU HÌNH BAN ĐẦU TỪ API GET /api/payments/config/
    const fetchConfig = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/payments/config/');
            const data = response.data?.data || response.data;
            if (data) {
                const initialConfig = {
                    bank_bin: data.bank_bin || '970422',
                    account_no: data.account_no || '123456789',
                    account_name: (data.account_name || 'KHACH SAN TA DA NANG').toUpperCase()
                };
                setFormData(initialConfig);
                setSavedData(initialConfig);
                setIsEditing(false); // Đưa về chế độ xem khi làm mới
                if (data.updated_at) {
                    setLastUpdated(data.updated_at);
                }
            }
        } catch (error) {
            console.error('Lỗi khi tải cấu hình thanh toán:', error);
            showToast('error', error.response?.data?.message || 'Không thể tải cấu hình từ máy chủ.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    // 5. BẬT CHẾ ĐỘ CHỈNH SỬA (KHI BẤM NÚT "CẬP NHẬT")
    const handleStartEdit = () => {
        setIsEditing(true);
        // Tự động focus vào ô nhập đầu tiên
        setTimeout(() => {
            document.getElementById('bank_bin')?.focus();
        }, 50);
    };

    // 6. HỦY THAY ĐỔI (KHÔI PHỤC LẠI DỮ LIỆU ĐÃ LƯU TRƯỚC ĐÓ)
    const handleCancelEdit = () => {
        setFormData({ ...savedData });
        setIsEditing(false);
    };

    // 7. XỬ LÝ LỰA CHỌN NGÂN HÀNG TỪ DANH SÁCH GỢI Ý
    const handleSelectBank = (bin) => {
        if (!isEditing) return;
        setFormData(prev => ({ ...prev, bank_bin: bin }));
    };

    // Tìm thông tin ngân hàng hiện tại theo mã BIN
    const currentBank = POPULAR_BANKS.find(b => b.bin === formData.bank_bin);

    // 8. XỬ LÝ LƯU CẤU HÌNH (GỌI API PUT /api/payments/config/)
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        // Validate cơ bản phía client
        if (!formData.bank_bin.trim()) {
            showToast('error', 'Vui lòng nhập Mã BIN ngân hàng.');
            return;
        }
        if (!formData.account_no.trim()) {
            showToast('error', 'Vui lòng nhập Số tài khoản.');
            return;
        }
        if (!formData.account_name.trim()) {
            showToast('error', 'Vui lòng nhập Tên chủ tài khoản.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                bank_bin: formData.bank_bin.trim(),
                account_no: formData.account_no.trim(),
                account_name: formData.account_name.trim().toUpperCase()
            };

            const response = await api.put('/payments/config/', payload);
            const resData = response.data?.data || response.data;

            if (resData) {
                const updatedConfig = {
                    bank_bin: resData.bank_bin,
                    account_no: resData.account_no,
                    account_name: resData.account_name.toUpperCase()
                };
                setFormData(updatedConfig);
                setSavedData(updatedConfig);
                setIsEditing(false); // Trở về chế độ xem sau khi lưu thành công
                if (resData.updated_at) {
                    setLastUpdated(resData.updated_at);
                }
            }

            showToast('success', response.data?.message || 'Lưu cấu hình thanh toán VietQR thành công!');
        } catch (error) {
            console.error('Lỗi khi lưu cấu hình:', error);
            const errorMsg =
                error.response?.data?.message ||
                (error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : null) ||
                'Không thể cập nhật cấu hình. Vui lòng kiểm tra lại quyền Admin.';
            showToast('error', errorMsg);
        } finally {
            setIsSaving(false);
        }
    };


    // Format ngày giờ hiển thị
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

    // Sao chép nhanh
    const handleCopy = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Preview URL mã VietQR demo
    const demoAmount = 100000;
    const demoContent = 'DEMO KHACH SAN TA';
    const previewQrUrl = formData.bank_bin && formData.account_no
        ? `https://img.vietqr.io/image/${formData.bank_bin}-${formData.account_no}-compact2.jpg?amount=${demoAmount}&addInfo=${encodeURIComponent(demoContent)}&accountName=${encodeURIComponent(formData.account_name)}`
        : '';

    return (
        <div className="space-y-6 animate-fadeIn pb-12">
            {/* TOAST THÔNG BÁO THÀNH CÔNG / THẤT BẠI */}
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

            {/* HEADER PHÂN HỆ CÀI ĐẶT */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                            Cài Đặt Hệ Thống
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Quản lý các thiết lập vận hành, cấu hình cổng thanh toán VietQR và thông số cổng khách sạn
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={fetchConfig}
                        disabled={isLoading || isSaving}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </div>

            {/* CARD 1: CẤU HÌNH THANH TOÁN VIETQR */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Header Card */}
                <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                <span>Cấu hình Thanh toán VietQR</span>
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                    Động (Dynamic)
                                </span>
                                {isEditing ? (
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

                    {lastUpdated && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Cập nhật gần nhất: <strong className="text-slate-700">{formatDateTime(lastUpdated)}</strong></span>
                        </div>
                    )}
                </div>

                {/* Body Card: Layout 2 cột (Form bên trái, Live Preview bên phải) */}
                <div className="p-6 sm:p-8">
                    {isLoading ? (
                        <div className="py-16 text-center text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình thanh toán...</p>
                            <p className="text-xs text-slate-400 mt-1">Vui lòng chờ trong giây lát.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* CỘT TRÁI: FORM 3 INPUT CHÍNH (8 CỘT) */}
                            <div className="lg:col-span-7 space-y-5">
                                {/* Hướng dẫn & Lưu ý */}
                                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 flex items-start gap-3">
                                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="font-semibold text-blue-950">
                                            Nguyên lý hoạt động mã QR động:
                                        </p>
                                        <p className="text-blue-800 leading-relaxed">
                                            {isEditing ? (
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
                                        {!isEditing && (
                                            <span className="text-[10px] text-slate-400 font-normal italic">
                                                (Bấm &ldquo;Cập nhật&rdquo; để chọn)
                                            </span>
                                        )}
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {POPULAR_BANKS.slice(0, 6).map((b) => {
                                            const isSelected = formData.bank_bin === b.bin;
                                            return (
                                                <button
                                                    key={b.bin}
                                                    type="button"
                                                    onClick={() => handleSelectBank(b.bin)}
                                                    disabled={!isEditing}
                                                    className={`px-3 py-2 rounded-xl text-left border text-xs font-semibold transition flex items-center justify-between ${
                                                        !isEditing
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
                                    <div className="relative">
                                        <input
                                            id="bank_bin"
                                            type="text"
                                            value={formData.bank_bin}
                                            onChange={(e) => setFormData({ ...formData, bank_bin: e.target.value })}
                                            placeholder="Ví dụ: 970422 (MB Bank), 970436 (VCB)..."
                                            disabled={!isEditing}
                                            required
                                            className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-medium transition shadow-xs ${
                                                !isEditing
                                                    ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                            }`}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Mã BIN chuẩn Napas247 (gồm 6 chữ số). Ví dụ: <strong>970422</strong> cho MB Bank, <strong>970436</strong> cho Vietcombank.
                                    </p>
                                </div>

                                {/* INPUT 2: SỐ TÀI KHOẢN */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="account_no" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Số Tài Khoản Thụ Hưởng</span>
                                            <span className="text-rose-500">*</span>
                                        </label>
                                        {formData.account_no && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(formData.account_no, 'account_no')}
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
                                    <div className="relative">
                                        <input
                                            id="account_no"
                                            type="text"
                                            value={formData.account_no}
                                            onChange={(e) => setFormData({ ...formData, account_no: e.target.value.replace(/\s+/g, '') })}
                                            placeholder="Ví dụ: 123456789, 0905123456..."
                                            disabled={!isEditing}
                                            required
                                            className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold tracking-wider transition shadow-xs ${
                                                !isEditing
                                                    ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                            }`}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Số tài khoản ngân hàng chính thức nhận doanh thu đặt phòng của khách sạn.
                                    </p>
                                </div>

                                {/* INPUT 3: TÊN CHỦ TÀI KHOẢN */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="account_name" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Tên Chủ Tài Khoản (In hoa không dấu)</span>
                                            <span className="text-rose-500">*</span>
                                        </label>
                                        {formData.account_name && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(formData.account_name, 'account_name')}
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
                                    <div className="relative">
                                        <input
                                            id="account_name"
                                            type="text"
                                            value={formData.account_name}
                                            onChange={(e) => setFormData({ ...formData, account_name: e.target.value.toUpperCase() })}
                                            placeholder="Ví dụ: KHACH SAN TA DA NANG, NGUYEN VAN A..."
                                            disabled={!isEditing}
                                            required
                                            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold uppercase tracking-wide transition shadow-xs ${
                                                !isEditing
                                                    ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                            }`}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Tên chủ tài khoản hoặc tên công ty đăng ký với ngân hàng (tự động viết hoa).
                                    </p>
                                </div>

                                {/* KHU VỰC NÚT THAO TÁC: NÚT CẬP NHẬT HOẶC NÚT LƯU + HỦY */}
                                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                    {!isEditing ? (
                                        <button
                                            type="button"
                                            onClick={handleStartEdit}
                                            disabled={isLoading}
                                            className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                            <span>Cập nhật</span>
                                        </button>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-3 animate-fadeIn">
                                            <button
                                                type="submit"
                                                disabled={isSaving}
                                                className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        <span>Đang lưu cấu hình...</span>
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
                                                onClick={handleCancelEdit}
                                                disabled={isSaving}
                                                className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer flex items-center gap-1.5"
                                            >
                                                <X className="w-4 h-4 text-slate-400" />
                                                <span>Hủy thay đổi</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                            </div>

                            {/* CỘT PHẢI: LIVE PREVIEW MÃ VIETQR TRỰC QUAN (5 CỘT) */}
                            <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 flex flex-col items-center text-center">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs mb-4">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Xem trước mã VietQR khách hàng sẽ thấy
                                </div>

                                {/* Khung hình ảnh VietQR với viền đứt nét */}
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
                                            <span>Nhập đầy đủ thông tin để tạo mã</span>
                                        </div>
                                    )}
                                </div>

                                {/* Thông tin tóm tắt bên dưới QR */}
                                <div className="w-full mt-4 bg-white rounded-2xl p-4 border border-slate-200/70 text-left space-y-2 text-xs">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <span className="text-slate-500">Ngân hàng:</span>
                                        <strong className="text-slate-900 font-semibold truncate max-w-[170px]">
                                            {currentBank?.shortName || formData.bank_bin || '—'}
                                        </strong>
                                    </div>
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <span className="text-slate-500">Số tài khoản:</span>
                                        <span className="font-mono font-bold text-slate-900">
                                            {formData.account_no || '—'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Chủ tài khoản:</span>
                                        <strong className="text-slate-900 font-bold uppercase truncate max-w-[170px]">
                                            {formData.account_name || '—'}
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
        </div>
    );
}
