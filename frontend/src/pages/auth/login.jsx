import React, { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

export default function AuthBookingPage() {
    const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

    // Login form state
    const [loginForm, setLoginForm] = useState({
        identifier: '', // Email hoặc Số điện thoại
        password: ''
    });

    // Register form state
    const [registerForm, setRegisterForm] = useState({
        fullName: '',
        phone: '',
        email: '',
        password: '',
        agreeTerms: true
    });

    // Accordion FAQ state
    const [activeFaq, setActiveFaq] = useState(0);

    const faqs = [
        {
            q: 'Tôi không nhớ mã đặt phòng thì tìm lại bằng cách nào?',
            a: 'Quý khách chỉ cần đăng nhập tài khoản bằng số điện thoại hoặc email đã dùng khi đặt phòng. Toàn bộ danh sách đặt phòng đã qua và sắp tới sẽ hiển thị đầy đủ cùng mã số xác nhận (Booking ID) và chứng từ liên quan.'
        },
        {
            q: 'Làm sao để thay đổi ngày nhận phòng qua tài khoản?',
            a: 'Trong mục "Đặt phòng của tôi", chọn mã đặt chỗ cần đổi và nhấn "Yêu cầu thay đổi ngày". Hệ thống sẽ tự động kiểm tra tình trạng phòng trống và hỗ trợ đổi lịch miễn phí theo chính sách hủy đổi linh hoạt 24h.'
        },
        {
            q: 'Tôi có thể đặt phòng cho người khác bằng tài khoản của mình không?',
            a: 'Hoàn toàn được. Trong quá trình đặt phòng, quý khách chỉ cần tích chọn "Đặt cho người khác" và điền họ tên, số điện thoại của khách lưu trú thực tế. Quý khách vẫn theo dõi và quản lý hóa đơn trên tài khoản của mình.'
        }
    ];

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        alert(`Đăng nhập thành công với tài khoản: ${loginForm.identifier}`);
    };

    const handleRegisterSubmit = (e) => {
        e.preventDefault();
        alert(`Đăng ký tài khoản thành công cho Quý khách: ${registerForm.fullName}`);
        setActiveTab('login');
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* Reusable Navbar */}
            <Navbar />


            {/* 3. BREADCRUMB */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <a href="/" className="hover:text-blue-600 transition">Trang chủ</a>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold">Tài khoản đặt phòng</span>
                    </nav>
                </div>
            </div>

            {/* 4. MAIN AUTH SECTION (SPLIT LAYOUT) */}
            <main className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    {/* LEFT COLUMN: BOOKING MANAGEMENT BENEFITS & MOCKUP TICKET */}
                    <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-2xl flex flex-col justify-between relative overflow-hidden">
                        {/* Background ambient lighting */}
                        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10">
                            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider mb-4 inline-block">
                                Cổng Quản Lý Đặt Phòng Khách Hàng
                            </span>
                            <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight mb-4">
                                Quản lý kỳ nghỉ dễ dàng & tiện lợi
                            </h1>
                            <p className="text-slate-300 text-xs sm:text-sm font-light leading-relaxed mb-8">
                                Đăng nhập để theo dõi trạng thái các chuyến đi, tra cứu mã xác nhận đặt phòng, tải hóa đơn điện tử hoặc thay đổi lịch trình bất cứ lúc nào.
                            </p>

                            {/* MOCKUP BOOKING CONFIRMATION TICKET */}
                            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 mb-8 shadow-xl relative overflow-hidden">
                                <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="font-semibold text-emerald-300 uppercase tracking-wider text-[11px]">
                                            Đặt phòng đã xác nhận
                                        </span>
                                    </div>
                                    <span className="font-mono text-slate-300 font-bold">#TA-280325-VN</span>
                                </div>
                                <div className="py-4 space-y-2.5">
                                    <div className="font-serif text-lg font-bold text-white">
                                        Executive Club Seafront Suite
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase">Nhận phòng</span>
                                            <strong className="text-slate-100">14:00 - 28/03/2025</strong>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase">Trả phòng</span>
                                            <strong className="text-slate-100">12:00 - 31/03/2025 (3 đêm)</strong>
                                        </div>
                                    </div>
                                    <div className="pt-2 flex items-center justify-between text-xs text-slate-300 border-t border-white/10">
                                        <span>Số khách: <strong>2 Người lớn</strong></span>
                                        <span className="text-amber-300 font-bold">VIP Club Lounge Access</span>
                                    </div>
                                </div>
                                <div className="bg-white/5 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>Khách Sạn TA Đà Nẵng • Bãi biển Mỹ Khê</span>
                                    <span className="text-blue-300 font-medium cursor-pointer hover:underline">Chi tiết voucher →</span>
                                </div>
                            </div>

                            {/* 4 CORE ADVANTAGES */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="flex items-start gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
                                    <span className="text-blue-400 text-base">🔍</span>
                                    <div>
                                        <strong className="text-white block font-semibold mb-0.5">Theo dõi đặt phòng 24/7</strong>
                                        <span className="text-slate-300 text-[11px] leading-relaxed">
                                            Tra cứu tình trạng phòng, giờ check-in/out và mã xác nhận tức thời.
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
                                    <span className="text-blue-400 text-base">⚡</span>
                                    <div>
                                        <strong className="text-white block font-semibold mb-0.5">Đặt phòng 1-chạm</strong>
                                        <span className="text-slate-300 text-[11px] leading-relaxed">
                                            Tự động điền thông tin cá nhân, không cần nhập lại cho chuyến đi sau.
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
                                    <span className="text-blue-400 text-base">📄</span>
                                    <div>
                                        <strong className="text-white block font-semibold mb-0.5">Hóa đơn điện tử VAT</strong>
                                        <span className="text-slate-300 text-[11px] leading-relaxed">
                                            Tải ngay chứng từ thanh toán phục vụ công tác và thanh toán đoàn.
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
                                    <span className="text-blue-400 text-base">🔄</span>
                                    <div>
                                        <strong className="text-white block font-semibold mb-0.5">Đổi lịch linh hoạt</strong>
                                        <span className="text-slate-300 text-[11px] leading-relaxed">
                                            Chủ động thay đổi ngày hoặc gửi yêu cầu hỗ trợ phòng tiện nghi.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom concierge contact */}
                        <div className="relative z-10 pt-8 mt-8 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                Tổng đài hỗ trợ đặt phòng trực tuyến
                            </span>
                            <span className="text-white font-bold">1900 8899</span>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: AUTHENTICATION FORM CARD */}
                    <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 flex flex-col justify-between">
                        <div>
                            {/* TAB SWITCHER */}
                            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('login')}
                                    className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 ${activeTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    Đăng Nhập
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('register')}
                                    className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${activeTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    Đăng Ký Tài Khoản
                                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-extrabold">
                                        Mới
                                    </span>
                                </button>
                            </div>

                            {/* 1. LOGIN FORM */}
                            {activeTab === 'login' && (
                                <form onSubmit={handleLoginSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Email hoặc Số điện thoại đặt phòng <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                value={loginForm.identifier}
                                                onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                                                placeholder="vidu@email.com hoặc 0901234567"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">✉️</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold text-slate-700">
                                                Mật khẩu <span className="text-red-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => alert('Vui lòng kiểm tra email hoặc SMS để nhận mã khôi phục mật khẩu.')}
                                                className="text-xs text-blue-600 hover:underline font-semibold"
                                            >
                                                Quên mật khẩu?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                value={loginForm.password}
                                                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                                placeholder="Nhập mật khẩu của quý khách"
                                                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔒</span>
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
                                            >
                                                {showPassword ? 'Ẩn' : 'Hiện'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>Ghi nhớ đăng nhập trên thiết bị này</span>
                                        </label>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        Đăng Nhập Tài Khoản Đặt Phòng
                                    </button>
                                </form>
                            )}

                            {/* 2. REGISTER FORM */}
                            {activeTab === 'register' && (
                                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Họ và tên khách lưu trú <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={registerForm.fullName}
                                            onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                                            placeholder="Nguyễn Văn A (như trên CCCD/Hộ chiếu)"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Số điện thoại <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={registerForm.phone}
                                                onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                                                placeholder="0901 234 567"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Địa chỉ Email <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={registerForm.email}
                                                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                                placeholder="vidu@email.com"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Thiết lập mật khẩu <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                minLength={8}
                                                value={registerForm.password}
                                                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                                                placeholder="Tối thiểu 8 ký tự"
                                                className="w-full px-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
                                            >
                                                {showPassword ? 'Ẩn' : 'Hiện'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="py-1">
                                        <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 leading-relaxed">
                                            <input
                                                type="checkbox"
                                                required
                                                checked={registerForm.agreeTerms}
                                                onChange={(e) => setRegisterForm({ ...registerForm, agreeTerms: e.target.checked })}
                                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>
                                                Tôi đồng ý với <a href="#dieu-khoan" className="text-blue-600 underline">Điều khoản dịch vụ</a> và <a href="#bao-mat" className="text-blue-600 underline">Chính sách bảo mật thông tin</a> của Khách Sạn TA Đà Nẵng.
                                            </span>
                                        </label>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        Hoàn Tất Đăng Ký Tài Khoản
                                    </button>
                                </form>
                            )}

                            {/* SOCIAL / QUICK LOGIN */}
                            <div className="mt-8">
                                <div className="relative flex items-center justify-center mb-6">
                                    <div className="border-t border-slate-200 w-full" />
                                    <span className="bg-white px-3 text-[11px] text-slate-400 uppercase font-semibold tracking-wider absolute">
                                        Hoặc đăng nhập nhanh với
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => alert('Đang kết nối Google Account...')}
                                        className="py-2.5 px-3 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        <span>🌐</span> <span>Google</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => alert('Đang kết nối Apple ID...')}
                                        className="py-2.5 px-3 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        <span>🍎</span> <span>Apple ID</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => alert('Mã OTP xác thực đã được gửi về số điện thoại của bạn.')}
                                        className="py-2.5 px-3 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        <span>💬</span> <span>Mã OTP SMS</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* SECURITY & CONCIERGE FOOTNOTE */}
                        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <span className="text-emerald-500">🛡️</span>
                                <span>Bảo mật chuẩn SSL 256-bit</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span>📞</span>
                                <span>Hỗ trợ Concierge: <strong>1900 8899</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 5. THREE PRACTICAL STEPS WITH BOOKING ACCOUNT */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Trải Nghiệm Liền Mạch</span>
                        <h2 className="font-serif text-3xl font-bold text-slate-900 mt-2">
                            Tiện ích khi có tài khoản Khách Sạn TA Đà Nẵng
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-2">
                            Tất cả mọi thông tin kỳ nghỉ được lưu trữ tập trung, an toàn và sẵn sàng phục vụ quý khách.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mb-4">1</div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-2">Đặt phòng nhanh chóng</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Lưu sẵn thông tin hành khách, yêu cầu gối nệm, thói quen ăn uống và phương thức thanh toán an toàn để hoàn tất đặt chỗ trong chưa đầy 30 giây.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mb-4">2</div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-2">Tra cứu mã đặt chỗ mọi lúc</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Xuất trình voucher điện tử hoặc mã Booking ID trực tiếp tại quầy lễ tân ngay trên điện thoại mà không lo thất lạc email hay tin nhắn.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mb-4">3</div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-2">Hỗ trợ khách hàng ưu tiên</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Gửi yêu cầu đưa đón xe Mercedes sân bay, đặt nôi em bé hoặc chuẩn bị hoa tươi chúc mừng kỷ niệm trực tiếp đến quản gia trước giờ nhận phòng.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. FAQ & CORPORATE BANNER */}
            <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    {/* FAQ Accordion */}
                    <div className="lg:col-span-7 space-y-4">
                        <div>
                            <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Giải đáp thắc mắc</span>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1 mb-6">
                                Câu hỏi thường gặp về tài khoản đặt phòng
                            </h2>
                        </div>
                        <div className="space-y-3">
                            {faqs.map((faq, idx) => (
                                <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition">
                                    <button
                                        type="button"
                                        onClick={() => setActiveFaq(activeFaq === idx ? -1 : idx)}
                                        className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-blue-600 transition"
                                    >
                                        <span>{faq.q}</span>
                                        <span className="text-slate-400 font-bold text-lg">{activeFaq === idx ? '−' : '+'}</span>
                                    </button>
                                    {activeFaq === idx && (
                                        <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Corporate Program Banner */}
                    <div className="lg:col-span-5 bg-gradient-to-br from-blue-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between">
                        <div>
                            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-wider mb-4 inline-block">
                                🏢 Dành cho Doanh Nghiệp & Phái Đoàn
                            </span>
                            <h3 className="font-serif text-2xl font-bold leading-tight mb-3">
                                Chương Trình Khách Hàng Doanh Nghiệp TA Corporate
                            </h3>
                            <p className="text-slate-300 text-xs leading-relaxed mb-6 font-light">
                                Thiết kế gói hội nghị, phòng nghỉ chuyên biệt cho ban điều hành và đối tác cấp cao với chính sách công nợ linh hoạt và quản lý tài khoản riêng biệt.
                            </p>
                        </div>
                        <div className="space-y-4 pt-6 border-t border-white/10">
                            <div className="text-xs">
                                <span className="text-slate-400 block text-[11px]">Hotline phòng khách doanh nghiệp:</span>
                                <strong className="text-white text-base">+84 (0) 236 388 9900 (Ext: 2)</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => alert('Yêu cầu tư vấn doanh nghiệp đã được gửi đến bộ phận kinh doanh.')}
                                className="w-full py-3 bg-white text-blue-950 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-md transition"
                            >
                                Đăng Ký Tư Vấn Doanh Nghiệp →
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Reusable Footer */}
            <Footer />
        </div>
    );
}