import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import api from '../../services/api';
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
    Sparkles,
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
    X,
} from 'lucide-react';

const DEPARTMENT_LABELS = {
    reservations: 'Đặt phòng lưu trú & Suite',
    dining: 'Dịch vụ Ẩm thực & Bar (F&B)',
    spa: 'The Lotus Spa & Wellness',
    mice: 'Ban Sự Kiện Đoàn & M.I.C.E',
    transport: 'Đưa đón xe Mercedes Sân Bay',
    feedback: 'Góp ý & Chăm sóc Khách hàng',
};

export default function ContactPage() {
    // Hotel brand & operational settings from backend
    const [hotelInfo, setHotelInfo] = useState({
        hotel_name: 'Khách Sạn TA Đà Nẵng',
        hotel_slogan: 'Khách Sạn & Khu Nghỉ Dưỡng',
        address: '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Phường Mỹ An, Quận Ngũ Hành Sơn, Thành phố Đà Nẵng, Việt Nam',
        hotline: '1900 8899',
        phone_number: '+84 (0) 236 388 9900',
        email: 'contact@tahotel.vn',
        check_in_time: '14:00',
        check_out_time: '12:00',
        banner_contact: '',
        stars: 5,
    });

    useEffect(() => {
        let isMounted = true;
        api.get('/hotel-settings/')
            .then(res => {
                const data = res.data?.data || res.data;
                if (data && isMounted) {
                    setHotelInfo(prev => ({
                        ...prev,
                        hotel_name: data.hotel_name || prev.hotel_name,
                        hotel_slogan: data.hotel_slogan || prev.hotel_slogan,
                        address: data.address || prev.address,
                        hotline: data.hotline || prev.hotline,
                        phone_number: data.phone_number || prev.phone_number,
                        email: data.email || prev.email,
                        check_in_time: data.check_in_time || prev.check_in_time,
                        check_out_time: data.check_out_time || prev.check_out_time,
                        banner_contact: data.banner_contact || prev.banner_contact,
                        stars: data.star_rating || data.stars || prev.stars,
                    }));
                }
            })
            .catch(() => {});
        return () => { isMounted = false; };
    }, []);

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

    const [copiedAddress, setCopiedAddress] = useState(false);
    const [activeFaq, setActiveFaq] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', text }

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
            q: 'Làm thế nào để đặt dịch vụ đưa đón sân bay riêng?',
            a: 'Quý khách có thể tích chọn yêu cầu đón tiễn khi đặt phòng trực tuyến, hoặc điền trực tiếp vào form liên hệ ở trên kèm theo mã số chuyến bay và giờ hạ cánh. Đội xe Mercedes-Benz & DCar VIP của khách sạn sẽ xác nhận lịch đón trước ít nhất 12 giờ.'
        }
    ];

    const handleCopyAddress = () => {
        const address = hotelInfo.address || '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Phường Mỹ An, Quận Ngũ Hành Sơn, Thành phố Đà Nẵng, Việt Nam';
        navigator.clipboard.writeText(address);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2500);
    };

    const showToast = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 4500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        // Backend chỉ lưu name/email/subject/message nên các thông tin bổ sung được đính kèm vào cuối nội dung
        const extraLines = [
            formData.phone && `Số điện thoại: ${formData.phone}`,
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
            setFormData({
                fullName: '',
                phone: '',
                email: '',
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
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-500 selection:text-white flex flex-col">
            {/* Reusable Navbar */}
            <Navbar />

            {/* Toast thông báo kết quả gửi liên hệ */}
            {toast && (
                <div
                    role="status"
                    className={`fixed top-24 right-5 z-[60] max-w-sm flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
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
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                        <Link to="/" className="hover:text-amber-600 transition">Trang chủ</Link>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-900 font-semibold">Liên hệ & Chỉ dẫn đường đi</span>
                    </nav>
                </div>
            </div>

            {/* HERO BANNER CHUẨN LUXURY HOTEL & RESORT */}
            <header className="relative bg-slate-950 overflow-hidden py-16 lg:py-24 border-b border-slate-800 shadow-md">
                <img
                    src={hotelInfo.banner_contact || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=90"}
                    alt="Khách Sạn TA Đà Nẵng Luxury Resort & Concierge"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* Gradient Overlay tối bảo vệ độ tương phản chữ */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/30" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl flex flex-col items-start text-left">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 backdrop-blur-md mb-4 text-amber-300 text-xs font-bold tracking-wider uppercase">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Đón Tiếp & Chăm Sóc Thượng Lưu 24/7</span>
                        </div>

                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                            Kết Nối & Chỉ Dẫn Đường Đi <br className="hidden sm:inline" />
                            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                                {hotelInfo.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                            </span>
                        </h1>

                        <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed font-normal max-w-2xl drop-shadow-md">
                            Đội ngũ Quản gia & Chuyên viên Chăm sóc Khách hàng luôn sẵn sàng lắng nghe, tư vấn kỳ nghỉ thượng lưu và tiếp nhận mọi yêu cầu riêng biệt của Quý khách với sự chu đáo tuyệt đối 24/7.
                        </p>
                    </div>
                </div>
            </header>

            {/* MAIN SECTION: FORM (LEFT) + DIRECT CONTACT CARD (RIGHT) */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT: INTERACTIVE CONTACT FORM */}
                    <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 sm:p-10 space-y-6">
                        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                            <div>
                                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                                    Tiếp Nhận 24/7
                                </span>
                                <h2 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                                    Gửi Yêu Cầu Liên Hệ
                                </h2>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center shadow-2xs">
                                <Mail className="w-6 h-6" />
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Họ và tên <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Nguyễn Văn A"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white transition shadow-2xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Số điện thoại <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="(+84) 90 123 4567"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white transition shadow-2xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Địa chỉ email <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="guest@domain.com"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white transition shadow-2xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Bộ phận tiếp nhận <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white transition shadow-2xs appearance-none pr-10 cursor-pointer"
                                        >
                                            <option value="reservations">Đặt phòng lưu trú & Suite</option>
                                            <option value="dining">Dịch vụ Ẩm thực & Bar (F&B)</option>
                                            <option value="spa">The Lotus Spa & Wellness</option>
                                            <option value="mice">Ban Sự Kiện Đoàn & M.I.C.E</option>
                                            <option value="transport">Đưa đón xe Mercedes Sân Bay</option>
                                            <option value="feedback">Góp ý & Chăm sóc Khách hàng</option>
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Tiêu đề yêu cầu <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={255}
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="Ví dụ: Đặt phòng Ocean Penthouse dịp kỷ niệm ngày cưới"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white transition shadow-2xs"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Nội dung tin nhắn & Yêu cầu đặc biệt <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[11px] text-slate-400">Tùy chọn gối nệm, ăn kiêng, giờ check-in</span>
                                </div>
                                <textarea
                                    rows={4}
                                    required
                                    maxLength={4500}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Quý khách có thể cung cấp thêm thông tin về số lượng khách, chế độ ăn uống đặc biệt (thuần chay, gluten-free), sở thích gối lông vũ / thảo mộc, hoặc mong muốn đón sân bay chuyên biệt..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:bg-white transition shadow-2xs leading-relaxed"
                                />
                            </div>

                            <div className="py-1">
                                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={formData.receiveViaZalo}
                                        onChange={(e) => setFormData({ ...formData, receiveViaZalo: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <span>
                                        Tôi muốn nhận tư vấn ưu tiên & xác nhận nhanh qua <strong className="text-amber-700">Zalo / WhatsApp</strong> trên số điện thoại này
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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

                    {/* RIGHT: HEADQUARTERS & SPECIALIZED DEPARTMENTS */}
                    <div className="lg:col-span-5 space-y-6">

                        {/* Flagship Address Box */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-sm">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div>
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block">
                                        Trụ sở nghỉ dưỡng Flagship
                                    </span>
                                    <h3 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                                        {hotelInfo.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                                    <MapPin className="w-5 h-5" />
                                </div>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                                {hotelInfo.address || '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Phường Mỹ An, Quận Ngũ Hành Sơn, Thành phố Đà Nẵng, Việt Nam.'}
                            </p>
                            <p className="text-xs text-slate-500 mb-5 italic">
                                {hotelInfo.hotel_slogan || 'Kiệt tác nghỉ dưỡng ven biển đẳng cấp quốc tế.'}
                            </p>

                            <div className="flex flex-wrap gap-2.5">
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelInfo.address || 'Khách Sạn TA Đà Nẵng')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/70 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-2xs"
                                >
                                    <Compass className="w-3.5 h-3.5" />
                                    <span>Mở Google Maps</span>
                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                </a>
                                <button
                                    type="button"
                                    onClick={handleCopyAddress}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
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

                        {/* Specialized Departments Contacts */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-sm space-y-5">
                            <div>
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">
                                    Kênh tiếp nhận chuyên môn
                                </span>
                                <h3 className="font-serif text-lg font-bold text-slate-900">
                                    Các Phòng Ban Trực Thuộc
                                </h3>
                            </div>

                            <div className="space-y-3.5 text-xs">
                                {/* 1. Reservations */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/20 transition flex items-start gap-3.5">
                                    <div className="w-9 h-9 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/50">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block">Phòng Đặt Phòng (Reservations)</strong>
                                        <span className="text-slate-500 block text-[11px] mt-0.5">
                                            {hotelInfo.phone_number || '(+84) 236 388 9900'} - <span className="text-amber-600 font-bold">Ext 1</span>
                                        </span>
                                        <a href={`mailto:${hotelInfo.email || 'booking@tadananghotel.com'}`} className="text-slate-600 hover:text-amber-600 hover:underline block truncate mt-0.5">
                                            {hotelInfo.email || 'booking@tadananghotel.com'}
                                        </a>
                                    </div>
                                </div>

                                {/* 2. Dining & F&B */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/20 transition flex items-start gap-3.5">
                                    <div className="w-9 h-9 rounded-xl bg-orange-100/70 text-orange-700 flex items-center justify-center shrink-0 border border-orange-200/50">
                                        <UtensilsCrossed className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block">Dịch Vụ Ẩm Thực & Bar (F&B)</strong>
                                        <span className="text-slate-500 block text-[11px] mt-0.5">
                                            {hotelInfo.phone_number || '(+84) 236 388 9900'} - <span className="text-amber-600 font-bold">Ext 2</span>
                                        </span>
                                        <a href={`mailto:${hotelInfo.email || 'dining@tadananghotel.com'}`} className="text-slate-600 hover:text-amber-600 hover:underline block truncate mt-0.5">
                                            {hotelInfo.email || 'dining@tadananghotel.com'}
                                        </a>
                                    </div>
                                </div>

                                {/* 3. Spa */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/20 transition flex items-start gap-3.5">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/50">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block">The Lotus Spa & Wellness</strong>
                                        <span className="text-slate-500 block text-[11px] mt-0.5">
                                            {hotelInfo.phone_number || '(+84) 236 388 9900'} - <span className="text-amber-600 font-bold">Ext 3</span>
                                        </span>
                                        <a href={`mailto:${hotelInfo.email || 'spa@tadananghotel.com'}`} className="text-slate-600 hover:text-amber-600 hover:underline block truncate mt-0.5">
                                            {hotelInfo.email || 'spa@tadananghotel.com'}
                                        </a>
                                    </div>
                                </div>

                                {/* 4. Events & MICE */}
                                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/20 transition flex items-start gap-3.5">
                                    <div className="w-9 h-9 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200/50">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 font-bold block">Ban Sự Kiện Đoàn & M.I.C.E</strong>
                                        <span className="text-slate-500 block text-[11px] mt-0.5">
                                            {hotelInfo.phone_number || '(+84) 236 388 9900'} - <span className="text-amber-600 font-bold">Ext 4</span>
                                        </span>
                                        <a href={`mailto:${hotelInfo.email || 'mice@tadananghotel.com'}`} className="text-slate-600 hover:text-amber-600 hover:underline block truncate mt-0.5">
                                            {hotelInfo.email || 'mice@tadananghotel.com'}
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* VIP Emergency Card */}
                            <a
                                href={`tel:${(hotelInfo.hotline || '1900 8899').replace(/\s+/g, '')}`}
                                className="block mt-4 p-4.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 text-white border border-amber-500/30 hover:border-amber-400 shadow-xl transition-all duration-300 hover:scale-[1.01] group"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                                            Hotline Khẩn Cấp VIP 24/7 (Bấm để gọi)
                                        </span>
                                        <strong className="text-xl font-bold font-mono tracking-wider block text-white group-hover:text-amber-300 transition mt-0.5">
                                            {hotelInfo.hotline || '1900 8899'}
                                        </strong>
                                        <span className="block text-[10px] text-slate-300 mt-0.5">
                                            Điện thoại bàn: {hotelInfo.phone_number || '(+84) 236 388 9900'}
                                        </span>
                                    </div>
                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 shrink-0 group-hover:scale-110 transition-transform">
                                        <PhoneCall className="w-5 h-5 animate-pulse" />
                                    </div>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* INTERACTIVE MAP SECTION & 4 KEY TRAVEL TIMES */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <span className="text-xs uppercase font-bold tracking-widest text-amber-600">
                                Tọa độ đắc địa & Khả năng tiếp cận
                            </span>
                            <h2 className="font-serif text-3xl font-bold text-slate-900 mt-1">
                                Bản Đồ Vị Trí & Hướng Dẫn Di Chuyển
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                                {hotelInfo.hotel_name || 'Khách Sạn TA Đà Nẵng'} sở hữu vị trí đắc địa, kết nối thông suốt với cảng hàng không quốc tế, ga đường sắt và các địa danh du lịch nổi tiếng.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                            <MapPin className="w-4 h-4 text-amber-600" />
                            <span>{hotelInfo.address || '08 Võ Nguyên Giáp, Đà Nẵng'}</span>
                        </div>
                    </div>

                    {/* BẢN ĐỒ THỰC TẾ GOOGLE MAPS */}
                    <div className="w-full h-[460px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative bg-slate-100">
                        <iframe
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(hotelInfo.address || 'Khách Sạn TA Đà Nẵng')}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title={`Bản đồ vị trí thực tế ${hotelInfo.hotel_name || 'Khách Sạn TA Đà Nẵng'}`}
                            className="w-full h-full"
                        />

                        {/* Overlaid Hotel Pin Card */}
                        <div className="absolute top-4 left-4 max-w-xs bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/60 pointer-events-auto">
                            <div className="flex items-center gap-0.5 text-amber-500 text-xs mb-1">
                                {Array.from({ length: hotelInfo.stars || 5 }).map((_, i) => (
                                    <span key={i}>★</span>
                                ))}
                                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-800 ml-1">
                                    {hotelInfo.stars || 5}-Star Luxury Hotel
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm">
                                {hotelInfo.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                {hotelInfo.address || '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Q. Ngũ Hành Sơn'}
                            </p>
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    {hotelInfo.hotel_slogan || `Resort Đẳng Cấp ${hotelInfo.stars || 5} Sao`}
                                </span>
                            </div>
                        </div>

                        {/* Bottom Right CTA Link to Google Maps */}
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelInfo.address || 'Khách Sạn TA Đà Nẵng')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg border border-white/60 flex items-center gap-2 transition hover:scale-105 active:scale-95 pointer-events-auto group"
                        >
                            <Navigation className="w-4 h-4 text-amber-600 group-hover:rotate-12 transition-transform" />
                            <span>Mở chỉ đường Google Maps</span>
                        </a>
                    </div>

                    {/* 4 TRAVEL TIME CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-amber-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center">
                                    <Plane className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                                    15 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Sân Bay Quốc Tế (DAD)</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 7.5 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Di chuyển dễ dàng bằng xe đưa đón Limousine riêng của khách sạn hoặc taxi cao cấp dọc cầu Rồng & Nguyễn Văn Linh.
                            </p>
                        </div>

                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-amber-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center">
                                    <Train className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                                    12 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Ga Xe Lửa Đà Nẵng</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 5.8 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Tuyến đường nhanh qua trung tâm thành phố và Cầu Sông Hàn, thuận tiện đón quý khách từ các chuyến tàu hỏa di sản.
                            </p>
                        </div>

                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-amber-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center">
                                    <Landmark className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                                    25 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Phố Cổ Hội An</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 22 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Cung đường biển thơ mộng Trường Sa - Lạc Long Quân đưa Quý khách đến Di sản Thế giới UNESCO Hội An trong chớp mắt.
                            </p>
                        </div>

                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 hover:border-amber-200 hover:shadow-md transition">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center">
                                    <Mountain className="w-5 h-5" />
                                </div>
                                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                                    15 phút
                                </span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Sơn Trà & Chùa Linh Ứng</h4>
                            <span className="text-[11px] text-slate-400 block mb-2 font-medium">Khoảng cách: 10 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Trải nghiệm rừng nguyên sinh Sơn Trà, viếng tượng Phật Bà Quán Âm cao nhất Việt Nam nhìn ra toàn cảnh vịnh biển Đà Nẵng.
                            </p>
                        </div>
                    </div>

                    {/* CHAUFFEUR FLEET BANNER */}
                    <div className="mt-10 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 border border-amber-500/30 text-white rounded-3xl p-6 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-xl">
                        <div className="max-w-xl">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 bg-amber-500/20 border border-amber-400/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
                                <Car className="w-3.5 h-3.5 text-amber-400" />
                                <span>Đặc quyền đưa đón hạng thương gia</span>
                            </span>
                            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-3">
                                Đội Xe Đưa Đón Riêng Mercedes-Benz & Maybach
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5 font-light">
                                Nâng tầm kỳ nghỉ ngay từ giây phút hạ cánh tại sân bay quốc tế Đà Nẵng. Đội xe sang trọng với tài xế chuyên nghiệp túc trực đón tại cửa ra VIP, phục vụ khăn lạnh thảo mộc, nước suối tinh khiết và wifi tốc độ cao xuyên suốt hành trình.
                            </p>
                            <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-200">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>Mercedes-Benz S-Class 2024</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>DCar Limousine 9 chỗ VIP</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>Tài xế giao tiếp Anh - Việt chuẩn mực</span>
                                </span>
                            </div>
                        </div>
                        <div className="w-full lg:w-96 h-56 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/10">
                            <img
                                src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80"
                                alt="Luxury Limousine Chauffeur Service"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="text-center mb-10">
                    <span className="text-xs uppercase font-bold tracking-widest text-amber-600">
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
                                        ? 'border-amber-300 shadow-md ring-1 ring-amber-300/30'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-amber-600 transition cursor-pointer"
                                >
                                    <span className={isOpen ? 'text-amber-700 font-bold' : ''}>
                                        {faq.q}
                                    </span>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                                        isOpen ? 'bg-amber-100 text-amber-700 rotate-180' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </button>
                                {isOpen && (
                                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3.5 bg-gradient-to-b from-amber-50/20 to-transparent">
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