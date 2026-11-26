import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { useHotelSettings, DEFAULT_BANNERS } from '../../store/hotelSettingStore';
import { useAuth } from '../../store/authStore';
import { contactService } from '../../services/contactService';
import {
    Mail,
    Send,
    PhoneCall,
    MapPin,
    Compass,
    Copy,
    Check,
    CheckCircle2,
    AlertCircle,
    Building2,
    UtensilsCrossed,
    Flower2,
    Users,
    Navigation,
    Plane,
    Train,
    Landmark,
    Mountain,
    Car,
    ShieldCheck,
    ChevronDown,
    ExternalLink,
    Clock,
    X,
} from 'lucide-react';

const DEPARTMENT_LABELS = {
    reservations: 'Đặt phòng lưu trú & Suite',
    dining: 'Dịch vụ Ẩm thực & Bar (F&B)',
    spa: 'Spa & Chăm sóc sức khỏe',
    mice: 'Đặt phòng Đoàn & Sự kiện (M.I.C.E)',
    transport: 'Dịch vụ Đưa đón Sân bay & Đặt xe',
    feedback: 'Góp ý & Chăm sóc Khách hàng',
};

export default function ContactPage() {
    const { settings } = useHotelSettings();
    const { user } = useAuth();

    // Thông tin thương hiệu & vận hành lấy đồng bộ từ hotelSettingStore (đã resolveMediaUrl)
    const hotelInfo = {
        hotel_name: settings?.hotel_name || 'Khách Sạn TA Đà Nẵng',
        hotel_slogan: settings?.hotel_slogan || 'Khách Sạn & Khu Nghỉ Dưỡng',
        address: settings?.address || '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Phường Mỹ An, Quận Ngũ Hành Sơn, Thành phố Đà Nẵng, Việt Nam',
        hotline: settings?.hotline || '1900 8899',
        phone_number: settings?.phone_number || '+84 (0) 236 388 9900',
        email: settings?.email || 'contact@tahotel.vn',
        check_in_time: settings?.check_in_time || '14:00',
        check_out_time: settings?.check_out_time || '12:00',
        banner_contact: settings?.banner_contact || DEFAULT_BANNERS.banner_contact,
        stars: Number(settings?.star_rating || settings?.stars) || 3,
    };

    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        department: 'reservations',
        subject: '',
        message: '',
        receiveViaZalo: false
    });

    // Tự động điền sẵn thông tin liên hệ khi khách hàng đã đăng nhập
    useEffect(() => {
        if (!user) return;
        const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '';
        const phone = user.phone_number || user.guest_profile?.phone_number || '';
        const email = user.email || '';

        setFormData((prev) => ({
            ...prev,
            fullName: prev.fullName || fullName,
            phone: prev.phone || phone,
            email: prev.email || email,
        }));
    }, [user]);

    const handleSelectDepartment = (deptKey, presetSubject = '') => {
        setFormData((prev) => ({
            ...prev,
            department: deptKey,
            subject: presetSubject && !prev.subject ? presetSubject : prev.subject,
        }));
        const formEl = document.getElementById('contact-form-card');
        if (formEl) {
            formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const [copiedAddress, setCopiedAddress] = useState(false);
    const [activeFaq, setActiveFaq] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', text }

    const toastTimerRef = useRef(null);
    const copyTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        };
    }, []);

    // FAQ list - bound to dynamic hotel name and check-in / check-out times
    const faqs = [
        {
            q: `Giờ nhận phòng và trả phòng tiêu chuẩn của ${hotelInfo.hotel_name} là mấy giờ?`,
            a: `Thời gian nhận phòng tiêu chuẩn (check-in) là từ ${hotelInfo.check_in_time} và trả phòng (check-out) trước ${hotelInfo.check_out_time} trưa. Khách sạn luôn hỗ trợ nhận phòng sớm hoặc trả phòng muộn linh hoạt tùy theo tình trạng phòng thực tế hoặc đặc quyền hạng phòng/hội viên TA Club.`
        },
        {
            q: 'Khách sạn có dịch vụ nhận gửi hành lý trước check-in hoặc sau check-out không?',
            a: 'Hoàn toàn có và hoàn toàn miễn phí. Đội ngũ Concierge và Bellman tại sảnh chính luôn sẵn sàng lưu trữ hành lý an toàn của quý khách với thẻ hành lý có mã số riêng trong thời gian quý khách dạo chơi hoặc chờ chuyến bay.'
        },
        {
            q: 'Làm thế nào để đặt dịch vụ đưa đón sân bay hoặc xe tham quan?',
            a: 'Quý khách có thể đặt kèm dịch vụ đưa đón khi đặt phòng trực tuyến, hoặc gửi yêu cầu qua form liên hệ ở trên kèm theo mã chuyến bay và giờ hạ cánh. Bộ phận Lễ tân sẽ sắp xếp xe 4–16 chỗ đời mới và xác nhận lịch đón trước ít nhất 12 giờ.'
        }
    ];

    const showToast = (type, text) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, text });
        toastTimerRef.current = setTimeout(() => setToast(null), 4500);
    };

    const handleCopyAddress = async () => {
        const address = hotelInfo.address;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(address);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = address;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            setCopiedAddress(true);
            copyTimerRef.current = setTimeout(() => setCopiedAddress(false), 2500);
        } catch {
            showToast('error', 'Không thể tự động sao chép địa chỉ trên trình duyệt này.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const digitsCount = formData.phone.replace(/\D/g, '').length;
        if (digitsCount < 8) {
            showToast('error', 'Vui lòng nhập số điện thoại hợp lệ (tối thiểu 8 chữ số).');
            return;
        }

        setIsSubmitting(true);

        // Backend chỉ lưu name/email/subject/message nên các thông tin bổ sung được đính kèm vào cuối nội dung
        const extraLines = [
            formData.phone && `Số điện thoại: ${formData.phone.trim()}`,
            `Bộ phận tiếp nhận: ${DEPARTMENT_LABELS[formData.department] || formData.department}`,
            formData.receiveViaZalo && 'Khách muốn nhận tư vấn qua Zalo / WhatsApp',
        ].filter(Boolean);
        const messageWithExtras = `${formData.message.trim()}\n\n---\n${extraLines.join('\n')}`;

        const res = await contactService.sendContact({
            name: formData.fullName.trim(),
            email: formData.email.trim(),
            subject: formData.subject.trim(),
            message: messageWithExtras,
        });

        setIsSubmitting(false);

        if (res.success) {
            showToast('success', 'Gửi liên hệ thành công! Chúng tôi sẽ phản hồi Quý khách trong thời gian sớm nhất.');
            const defaultName = user ? (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '') : '';
            const defaultPhone = user ? (user.phone_number || user.guest_profile?.phone_number || '') : '';
            const defaultEmail = user ? (user.email || '') : '';
            setFormData({
                fullName: defaultName,
                phone: defaultPhone,
                email: defaultEmail,
                department: 'reservations',
                subject: '',
                message: '',
                receiveViaZalo: false
            });
        } else {
            showToast('error', res.message || 'Không thể gửi liên hệ. Vui lòng thử lại sau.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-sky-600 selection:text-white flex flex-col">
            {/* Reusable Navbar */}
            <Navbar />

            {/* Toast thông báo kết quả gửi liên hệ */}
            {toast && (
                <div
                    role="status"
                    className={`fixed top-20 sm:top-24 left-4 right-4 sm:left-auto sm:right-5 z-[60] max-w-sm flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border text-xs sm:text-sm font-medium transition-all duration-300 ${
                        toast.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10'
                            : 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-500/10'
                    }`}
                >
                    <span className="shrink-0 mt-0.5">
                        {toast.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                        )}
                    </span>
                    <span className="flex-1 leading-snug">{toast.text}</span>
                    <button
                        type="button"
                        onClick={() => setToast(null)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition"
                        aria-label="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* BREADCRUMB THANH ĐIỀU HƯỚNG */}
            <div className="bg-slate-100/80 border-b border-slate-200/60 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 font-medium whitespace-nowrap overflow-x-auto no-scrollbar">
                        <Link to="/" className="hover:text-sky-600 transition shrink-0">Trang chủ</Link>
                        <span className="text-slate-300 shrink-0">/</span>
                        <span className="text-slate-900 font-semibold truncate min-w-0">Liên hệ & Chỉ dẫn đường đi</span>
                    </nav>
                </div>
            </div>

            {/* HERO BANNER CHUẨN LUXURY HOTEL & RESORT */}
            <header className="relative bg-slate-950 overflow-hidden py-10 lg:py-14 border-b border-slate-800 shadow-md">
                <img
                    src={hotelInfo.banner_contact || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=90"}
                    alt="Khách Sạn TA Đà Nẵng Luxury Resort & Concierge"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* Gradient Overlay tối bảo vệ độ tương phản chữ */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/30" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl flex flex-col items-start text-left">
                        

                        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                            Kết Nối & Chỉ Dẫn Đường Đi <br className="hidden sm:inline" />
                            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-sky-400 bg-clip-text text-transparent">
                                {hotelInfo.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                            </span>
                        </h1>

                        <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed font-normal max-w-2xl drop-shadow-md">
                            Đội ngũ Lễ tân & Chăm sóc Khách hàng luôn sẵn sàng tư vấn đặt phòng và hỗ trợ Quý khách 24/7.
                        </p>
                    </div>
                </div>
            </header>

            {/* MAIN SECTION: FORM (LEFT) + DIRECT CONTACT CARD (RIGHT) */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT (DESKTOP) / ĐẦU TIÊN (MOBILE): INTERACTIVE CONTACT FORM */}
                    <div id="contact-form-card" className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-md p-4 sm:p-8 space-y-4 sm:space-y-6 scroll-mt-24">
                        <div className="flex items-center justify-between pb-4 sm:pb-6 border-b border-slate-100">
                            <div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-sky-700 uppercase tracking-wider block">
                                    Tiếp Nhận 24/7
                                </span>
                                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">
                                    Gửi Yêu Cầu Liên Hệ
                                </h2>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-sky-50 border border-sky-200/70 text-sky-600 flex items-center justify-center shadow-2xs">
                                <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Họ và tên <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Nguyễn Văn A"
                                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 focus:bg-white transition shadow-2xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số điện thoại <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="(+84) 90 123 4567"
                                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 focus:bg-white transition shadow-2xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Địa chỉ email <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="guest@domain.com"
                                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 focus:bg-white transition shadow-2xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Bộ phận tiếp nhận <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 focus:bg-white transition shadow-2xs appearance-none pr-9 cursor-pointer font-medium"
                                        >
                                            <option value="reservations">Đặt phòng lưu trú & Suite</option>
                                            <option value="dining">Dịch vụ Ẩm thực & Bar (F&B)</option>
                                            <option value="spa">Spa & Chăm sóc sức khỏe</option>
                                            <option value="mice">Đặt phòng Đoàn & Sự kiện (M.I.C.E)</option>
                                            <option value="transport">Dịch vụ Đưa đón Sân bay & Đặt xe</option>
                                            <option value="feedback">Góp ý & Chăm sóc Khách hàng</option>
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                    {formData.department === 'mice' && (
                                        <p className="text-[11px] text-sky-700 mt-1.5">
                                            Cần đặt nhiều phòng ngay?{' '}
                                            <Link to="/corporate-booking" className="font-bold underline hover:text-sky-800">
                                                Mở trang Đặt phòng theo đoàn →
                                            </Link>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tiêu đề yêu cầu <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={255}
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="Ví dụ: Đặt phòng Ocean Penthouse dịp kỷ niệm ngày cưới"
                                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 focus:bg-white transition shadow-2xs"
                                />
                            </div>

                            <div>
                                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-0.5 sm:gap-2 mb-1.5">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Nội dung tin nhắn & Yêu cầu đặc biệt <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10.5px] sm:text-[11px] text-slate-400 font-normal">
                                        (Gối nệm, ăn kiêng, giờ check-in...)
                                    </span>
                                </div>
                                <textarea
                                    rows={4}
                                    required
                                    maxLength={4500}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Quý khách có thể cung cấp thêm thông tin về số lượng khách, chế độ ăn kiêng, sở thích gối nệm hoặc yêu cầu đón tiễn..."
                                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10 focus:bg-white transition shadow-2xs leading-relaxed"
                                />
                            </div>

                            <div className="pt-0.5">
                                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 group">
                                    <input
                                        type="checkbox"
                                        checked={formData.receiveViaZalo}
                                        onChange={(e) => setFormData({ ...formData, receiveViaZalo: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300 text-sky-600 accent-sky-600 focus:ring-sky-500 cursor-pointer mt-0.5 shrink-0"
                                    />
                                    <span className="leading-relaxed">
                                        Tôi muốn nhận tư vấn ưu tiên & xác nhận nhanh qua <strong className="text-sky-700">Zalo / WhatsApp</strong> trên số điện thoại này
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-sky-900/20 hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Đang gửi thông tin...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Gửi Yêu Cầu Liên Hệ</span>
                                        <Send className="w-4 h-4" />
                                    </>
                                )}
                            </button>

                            <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-2 border-t border-slate-100">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Bảo mật dữ liệu chuẩn mã hóa SSL 256-bit. Cam kết phản hồi từ nhân viên trong vòng 15 phút.</span>
                            </div>
                        </form>
                    </div>

                    {/* RIGHT (DESKTOP) / BÊN DƯỚI (MOBILE): HEADQUARTERS, HOTLINE 24/7 & DEPARTMENTS */}
                    <div className="lg:col-span-5 space-y-5">

                        {/* Flagship Address Box */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
                            <div className="flex items-start justify-between gap-4 mb-2.5">
                                <div>
                                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-widest block">
                                        Địa chỉ khách sạn
                                    </span>
                                    <h3 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                                        {hotelInfo.hotel_name}
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200/70 shadow-2xs">
                                    <MapPin className="w-5 h-5" />
                                </div>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-2">
                                {hotelInfo.address}
                            </p>
                            <p className="text-xs text-slate-500 mb-3.5 italic">
                                {hotelInfo.hotel_slogan}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                                <a
                                    href={`mailto:${hotelInfo.email}`}
                                    className="flex items-center gap-2 text-slate-700 hover:text-sky-700 transition min-w-0"
                                >
                                    <Mail className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    <span className="truncate font-medium">{hotelInfo.email}</span>
                                </a>
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    <span className="truncate">
                                        Nhận {hotelInfo.check_in_time} · Trả {hotelInfo.check_out_time}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelInfo.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 sm:flex-initial justify-center min-h-[40px] px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-2xs"
                                >
                                    <Compass className="w-3.5 h-3.5 shrink-0" />
                                    <span>Mở Google Maps</span>
                                    <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                                </a>
                                <button
                                    type="button"
                                    onClick={handleCopyAddress}
                                    className="flex-1 sm:flex-initial justify-center min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                                >
                                    {copiedAddress ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-emerald-700 font-bold">Đã chép</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Sao chép địa chỉ</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Specialized Departments Contacts (Interactive - click to select department on Form) */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-widest block mb-0.5">
                                        Chọn nhanh bộ phận cần liên hệ
                                    </span>
                                    <h3 className="font-serif text-lg font-bold text-slate-900">
                                        Các Phòng Ban Trực Thuộc
                                    </h3>
                                </div>
                                <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                                    {hotelInfo.phone_number}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                                {/* 1. Reservations */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectDepartment('reservations')}
                                    className={`p-3 rounded-2xl border transition flex items-start gap-2.5 text-left cursor-pointer ${
                                        formData.department === 'reservations'
                                            ? 'bg-sky-50/70 border-sky-400 ring-1 ring-sky-400/20'
                                            : 'bg-slate-50/80 border-slate-100 hover:border-sky-200 hover:bg-sky-50/30'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200/60">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block leading-snug">Đặt Phòng (Reservations)</strong>
                                        <span className="text-sky-700 font-semibold text-[11px] block mt-0.5">Ext 1 · Phục vụ 24/7</span>
                                    </div>
                                </button>

                                {/* 2. Dining & F&B */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectDepartment('dining')}
                                    className={`p-3 rounded-2xl border transition flex items-start gap-2.5 text-left cursor-pointer ${
                                        formData.department === 'dining'
                                            ? 'bg-sky-50/70 border-sky-400 ring-1 ring-sky-400/20'
                                            : 'bg-slate-50/80 border-slate-100 hover:border-sky-200 hover:bg-sky-50/30'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200/60">
                                        <UtensilsCrossed className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block leading-snug">Ẩm Thực & Bar (F&B)</strong>
                                        <span className="text-sky-700 font-semibold text-[11px] block mt-0.5">Ext 2 · 06:00 - 23:00</span>
                                    </div>
                                </button>

                                {/* 3. Spa */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectDepartment('spa')}
                                    className={`p-3 rounded-2xl border transition flex items-start gap-2.5 text-left cursor-pointer ${
                                        formData.department === 'spa'
                                            ? 'bg-sky-50/70 border-sky-400 ring-1 ring-sky-400/20'
                                            : 'bg-slate-50/80 border-slate-100 hover:border-sky-200 hover:bg-sky-50/30'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/50">
                                        <Flower2 className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block leading-snug">Spa & Wellness</strong>
                                        <span className="text-sky-700 font-semibold text-[11px] block mt-0.5">Ext 3 · 09:00 - 21:00</span>
                                    </div>
                                </button>

                                {/* 4. Events & MICE */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectDepartment('mice')}
                                    className={`p-3 rounded-2xl border transition flex items-start gap-2.5 text-left cursor-pointer ${
                                        formData.department === 'mice'
                                            ? 'bg-sky-50/70 border-sky-400 ring-1 ring-sky-400/20'
                                            : 'bg-slate-50/80 border-slate-100 hover:border-sky-200 hover:bg-sky-50/30'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200/50">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block leading-snug">Đoàn & Sự Kiện M.I.C.E</strong>
                                        <span className="text-sky-700 font-semibold text-[11px] block mt-0.5">Ext 4 · 08:00 - 18:00</span>
                                    </div>
                                </button>
                            </div>

                            {/* Hotline 24/7 Card */}
                            <a
                                href={`tel:${hotelInfo.hotline.replace(/\s+/g, '')}`}
                                className="block p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950 to-blue-950 text-white border border-sky-500/30 hover:border-sky-400 shadow-xl transition-all duration-300 hover:scale-[1.01] group"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <span className="text-[10px] text-sky-300 font-bold uppercase tracking-wider block">
                                            Hotline Hỗ Trợ 24/7 (Bấm để gọi)
                                        </span>
                                        <strong className="text-xl font-bold font-mono tracking-wider block text-white group-hover:text-sky-300 transition mt-0.5">
                                            {hotelInfo.hotline}
                                        </strong>
                                        <span className="block text-[11px] text-slate-300 mt-0.5 truncate">
                                            Điện thoại bàn: {hotelInfo.phone_number}
                                        </span>
                                    </div>
                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30 shrink-0 group-hover:scale-110 transition-transform">
                                        <PhoneCall className="w-5 h-5 animate-pulse" />
                                    </div>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* INTERACTIVE MAP SECTION & 4 KEY TRAVEL TIMES */}
            <section className="py-12 sm:py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <span className="text-xs uppercase font-bold tracking-widest text-sky-700">
                                Tọa độ thuận tiện & Kết nối
                            </span>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                                Bản Đồ Vị Trí & Hướng Dẫn Di Chuyển
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                                {hotelInfo.hotel_name} sở hữu vị trí thuận tiện, kết nối dễ dàng với sân bay quốc tế Đà Nẵng, ga đường sắt và các địa danh du lịch nổi tiếng.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                            <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                            <span>{hotelInfo.address}</span>
                        </div>
                    </div>

                    {/* BẢN ĐỒ THỰC TẾ GOOGLE MAPS */}
                    <div className="w-full h-[300px] sm:h-[400px] lg:h-[460px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative bg-slate-100">
                        <iframe
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(hotelInfo.address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title={`Bản đồ vị trí thực tế ${hotelInfo.hotel_name}`}
                            className="w-full h-full"
                        />

                        {/* Overlaid Hotel Pin Card (ẩn trên mobile để không chắn bản đồ) */}
                        <div className="hidden sm:block absolute top-4 left-4 max-w-xs bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/60 pointer-events-auto">
                            <div className="flex items-center gap-0.5 text-amber-500 text-xs mb-1">
                                {Array.from({ length: hotelInfo.stars }).map((_, i) => (
                                    <span key={i}>★</span>
                                ))}
                                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-800 ml-1">
                                    {hotelInfo.stars}-Star Hotel
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm">
                                {hotelInfo.hotel_name}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                {hotelInfo.address}
                            </p>
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    {hotelInfo.hotel_slogan || `Khách sạn tiêu chuẩn ${hotelInfo.stars} Sao`}
                                </span>
                            </div>
                        </div>

                        {/* Bottom Left CTA Link to Google Maps (trên desktop đè góc trái, trên mobile tách riêng bên dưới map để không chạm logo Google) */}
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelInfo.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:flex absolute bottom-4 left-4 bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg border border-white/60 items-center gap-2 transition hover:scale-105 active:scale-95 pointer-events-auto group"
                        >
                            <Navigation className="w-4 h-4 text-sky-600 group-hover:rotate-12 transition-transform" />
                            <span>Mở chỉ đường Google Maps</span>
                        </a>
                    </div>

                    {/* Nút chỉ đường Google Maps riêng cho Mobile (ngay dưới bản đồ, dễ bấm 1 tay) */}
                    <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelInfo.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sm:hidden mt-3 w-full min-h-[44px] bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs px-4 py-3 rounded-2xl border border-sky-200/90 flex items-center justify-center gap-2 transition active:scale-95"
                    >
                        <Navigation className="w-4 h-4 text-sky-600" />
                        <span>Mở chỉ đường Google Maps</span>
                    </a>

                    {/* 4 TRAVEL TIME CARDS (2 cột gọn trên mobile) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-6 mt-6 sm:mt-8">
                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-sky-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70 flex items-center justify-center">
                                    <Plane className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/70">
                                    15 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Sân Bay Quốc Tế (DAD)</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 7.5 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Di chuyển thuận tiện bằng dịch vụ xe đưa đón sân bay của khách sạn hoặc taxi dọc tuyến cầu Rồng & Nguyễn Văn Linh.
                            </p>
                        </div>

                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-sky-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70 flex items-center justify-center">
                                    <Train className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/70">
                                    12 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Ga Xe Lửa Đà Nẵng</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 5.8 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Tuyến đường nhanh qua trung tâm thành phố và Cầu Sông Hàn, thuận tiện đón quý khách từ các chuyến tàu hỏa di sản.
                            </p>
                        </div>

                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-sky-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70 flex items-center justify-center">
                                    <Landmark className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/70">
                                    25 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Phố Cổ Hội An</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 22 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Cung đường biển thơ mộng Trường Sa - Lạc Long Quân đưa Quý khách đến Di sản Thế giới UNESCO Hội An dễ dàng.
                            </p>
                        </div>

                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-sky-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/70 flex items-center justify-center">
                                    <Mountain className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/70">
                                    15 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Sơn Trà & Chùa Linh Ứng</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 10 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Trải nghiệm bán đảo Sơn Trà, viếng tượng Phật Bà Quán Âm và ngắm toàn cảnh vịnh biển Đà Nẵng.
                            </p>
                        </div>
                    </div>

                    {/* AIRPORT TRANSFER & TOUR CAR BANNER (SÁT THỰC TẾ KHÁCH SẠN 3 SAO) */}
                    <div className="mt-10 bg-gradient-to-br from-slate-900 via-sky-950 to-blue-950 border border-sky-500/25 text-white rounded-3xl p-6 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-xl">
                        <div className="max-w-xl">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 bg-sky-500/20 border border-sky-400/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
                                <Car className="w-3.5 h-3.5 text-sky-300" />
                                <span>Hỗ trợ di chuyển tiện lợi</span>
                            </span>
                            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-3">
                                Dịch Vụ Đưa Đón Sân Bay & Đặt Xe Tham Quan
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5 font-light">
                                Bộ phận Lễ tân hỗ trợ đặt xe đưa đón hai chiều sân bay quốc tế Đà Nẵng (DAD) và xe tham quan các điểm du lịch nổi tiếng với mức giá minh bạch, tài xế đúng giờ và chu đáo.
                            </p>
                            <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-200 mb-6">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                                    <span>Xe 4 – 16 chỗ đời mới, máy lạnh</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                                    <span>Đón tận cửa ga đến Sân bay Đà Nẵng</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                                    <span>Hỗ trợ đặt tour Hội An, Bà Nà, Sơn Trà</span>
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSelectDepartment('transport', 'Yêu cầu đặt xe đưa đón sân bay Đà Nẵng')}
                                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-5 py-3 sm:py-2.5 bg-gradient-to-r from-sky-500 via-blue-600 to-cyan-600 hover:from-sky-600 hover:via-blue-700 hover:to-cyan-700 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/30 transition cursor-pointer active:scale-95"
                            >
                                <span>Gửi yêu cầu đặt xe đưa đón</span>
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="w-full lg:w-96 h-56 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/10">
                            <img
                                src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80"
                                alt="Dịch vụ xe đưa đón sân bay khách sạn TA Đà Nẵng"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="text-center mb-10">
                    <span className="text-xs uppercase font-bold tracking-widest text-sky-700">
                        Giải đáp nhanh
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                        Câu Hỏi Thường Gặp Khi Liên Hệ & Lưu Trú
                    </h2>
                    <p className="text-xs text-slate-500 mt-1.5">
                        Các thông tin thiết yếu giúp Quý khách chuẩn bị chu đáo nhất cho chuyến hành trình nghỉ dưỡng tại Đà Nẵng.
                    </p>
                </div>
                <div className="space-y-3.5">
                    {faqs.map((faq, idx) => {
                        const isOpen = activeFaq === idx;
                        return (
                            <div
                                key={idx}
                                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                                    isOpen
                                        ? 'border-sky-300 shadow-md ring-1 ring-sky-300/30'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-sky-700 transition cursor-pointer"
                                >
                                    <span className={isOpen ? 'text-sky-700 font-bold' : ''}>
                                        {faq.q}
                                    </span>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                                        isOpen ? 'bg-sky-100 text-sky-700 rotate-180' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </button>
                                {isOpen && (
                                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3.5 bg-gradient-to-b from-sky-50/30 to-transparent">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Reusable Footer */}
            <Footer />
        </div>
    );
}