import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { isStaffRole, getRoleTitle } from '../../utils/permission';
import { useHotelSettings } from '../../store/hotelSettingStore';

export default function AuthBookingPage() {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const { settings } = useHotelSettings();

    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const starCount = settings?.stars || 3;
    const hotline = settings?.hotline || '1900 8899';

    const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

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

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        const result = await authService.login(loginForm.identifier, loginForm.password);
        setIsLoading(false);

        if (result.success) {
            const loggedInUser = result.data?.user;
            const isStaff = isStaffRole(loggedInUser);

            if (isStaff) {
                setSuccessMessage('Đăng nhập thành công! Đang chuyển hướng vào Hệ thống Quản trị & Bàn làm việc...');
                setTimeout(() => {
                    navigate('/admin');
                }, 600);
            } else {
                setSuccessMessage(result.data?.message || 'Đăng nhập thành công! Đang chuyển hướng về trang chủ...');
                setTimeout(() => {
                    navigate('/');
                }, 700);
            }
        } else {
            setErrorMessage(result.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        const result = await authService.register(registerForm);
        setIsLoading(false);

        if (result.success) {
            setSuccessMessage(result.data?.message || 'Đăng ký tài khoản thành công! Đang chuyển hướng về trang chủ...');
            setTimeout(() => {
                navigate('/');
            }, 800);
        } else {
            setErrorMessage(result.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.');
        }
    };

    const handleLogoutCurrent = async () => {
        await authService.logout();
        setSuccessMessage('Đã đăng xuất tài khoản thành công.');
        setErrorMessage(null);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
            {/* Reusable Navbar */}
            <Navbar />

            {/* BREADCRUMB */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold">Tài khoản & Đặt phòng</span>
                    </nav>
                </div>
            </div>

            {/* MAIN AUTH SECTION (DỊU MẮT, THẨM MỸ RESORT HIỆN ĐẠI, HÀI HÒA) */}
            <main className="relative py-12 lg:py-16 overflow-hidden flex items-center bg-slate-900 border-b border-slate-800">
                {/* 1. Ảnh nền Resort thư thái, sắc nét */}
                <img
                    src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2070&q=85"
                    alt={`${hotelName} Luxury Collection`}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* 2. Lớp phủ Gradient sâu lắng, dịu mắt với tone xanh sẫm & ngọc bích êm ái */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/85 to-slate-950/90 backdrop-blur-[1px]" />

                {/* Ánh sáng nền khuếch tán mềm (Soft Ambient Glow) */}
                <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* 3. Nội dung form & thông tin relative z-10 */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
                        
                        {/* CỘT TRÁI: QUẢN LÝ KỲ NGHỈ & VOUCHER MOCKUP CAO CẤP */}
                        <div className="lg:col-span-6 bg-slate-900/75 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 sm:p-9 text-white shadow-2xl flex flex-col justify-between relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    <span>Cổng Dịch Vụ Khách Hàng Thân Thiết</span>
                                </div>
                                <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-snug mb-3">
                                    Quản lý kỳ nghỉ dễ dàng & tiện lợi
                                </h1>
                                <p className="text-slate-300/90 text-xs sm:text-sm font-light leading-relaxed mb-6">
                                    Đăng nhập để xem lịch sử lưu trú, lưu sẵn thông tin check-in, nhận ưu đãi độc quyền dành cho hội viên và thay đổi lịch trình linh hoạt.
                                </p>

                                {/* MOCKUP BOOKING CONFIRMATION TICKET CỰC ĐẸP */}
                                <div className="bg-gradient-to-b from-white/12 to-white/5 backdrop-blur-md border border-white/15 rounded-2xl p-5 mb-6 shadow-xl relative overflow-hidden group">
                                    {/* Họa tiết tia sáng nhẹ */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

                                    {/* Header vé */}
                                    <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
                                            <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                                                Xác Nhận Đặt Phòng
                                            </span>
                                        </div>
                                        <span className="font-mono text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md font-bold text-[11px] border border-amber-400/20">
                                            #TA-280326-VN
                                        </span>
                                    </div>

                                    {/* Thân vé */}
                                    <div className="py-3.5 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide">
                                                    Executive Club Oceanfront Suite
                                                </div>
                                                <div className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5">
                                                    <span>Tầng 18</span>
                                                    <span>•</span>
                                                    <span>View Trực Diện Biển Mỹ Khê</span>
                                                    <span>•</span>
                                                    <span className="text-amber-300">{'★'.repeat(starCount)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs bg-black/20 p-3 rounded-xl border border-white/5">
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nhận phòng (Check-in)</span>
                                                <strong className="text-slate-100 text-[12px] block mt-0.5">14:00 - 28/03/2026</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Trả phòng (Check-out)</span>
                                                <strong className="text-slate-100 text-[12px] block mt-0.5">12:00 - 31/03/2026 (3 đêm)</strong>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                                            <span className="flex items-center gap-1.5">
                                                <span>👥</span>
                                                <span>Số khách: <strong className="text-white">2 Người lớn</strong></span>
                                            </span>
                                            <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <span>✨</span> VIP Club Lounge Access
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer vé */}
                                    <div className="bg-white/5 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10">
                                        <span className="flex items-center gap-1.5">
                                            <span>📍</span>
                                            <span>{hotelName} • Bãi biển Mỹ Khê</span>
                                        </span>
                                        <span className="text-blue-300 font-semibold cursor-pointer hover:underline flex items-center gap-1">
                                            <span>Xem voucher điện tử</span>
                                            <span>→</span>
                                        </span>
                                    </div>
                                </div>

                                {/* 4 LỢI THẾ CỐT LÕI */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="flex items-start gap-3 bg-white/5 hover:bg-white/10 p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 text-sm">
                                            🔍
                                        </div>
                                        <div>
                                            <strong className="text-white block font-semibold text-xs mb-0.5">Theo dõi lịch trình 24/7</strong>
                                            <span className="text-slate-300 text-[11px] leading-relaxed">
                                                Tra cứu phòng, giờ check-in/out và chứng từ tức thời.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 bg-white/5 hover:bg-white/10 p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 text-sm">
                                            ⚡
                                        </div>
                                        <div>
                                            <strong className="text-white block font-semibold text-xs mb-0.5">Đặt phòng 1-chạm</strong>
                                            <span className="text-slate-300 text-[11px] leading-relaxed">
                                                Tự động điền hồ sơ, tiết kiệm tối đa thời gian.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 bg-white/5 hover:bg-white/10 p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 text-sm">
                                            📄
                                        </div>
                                        <div>
                                            <strong className="text-white block font-semibold text-xs mb-0.5">Hóa đơn điện tử VAT</strong>
                                            <span className="text-slate-300 text-[11px] leading-relaxed">
                                                Xuất hóa đơn GTGT nhanh chóng cho cơ quan, đoàn công tác.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 bg-white/5 hover:bg-white/10 p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 text-sm">
                                            🔄
                                        </div>
                                        <div>
                                            <strong className="text-white block font-semibold text-xs mb-0.5">Đổi lịch linh hoạt 24h</strong>
                                            <span className="text-slate-300 text-[11px] leading-relaxed">
                                                Chủ động chuyển ngày hoặc gửi yêu cầu tiện ích phòng.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hotline chân cột trái */}
                            <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400" />
                                    <span>Hỗ trợ khách hàng trực tuyến 24/7</span>
                                </span>
                                <a href={`tel:${hotline.replace(/\s+/g, '')}`} className="text-amber-300 hover:text-white font-bold transition">
                                    Hotline: {hotline}
                                </a>
                            </div>
                        </div>

                        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ HIỆN ĐẠI, THẨM MỸ, DỊU MẮT */}
                        <div className="lg:col-span-6 bg-white/95 backdrop-blur-2xl rounded-3xl border border-slate-100 shadow-2xl p-7 sm:p-9 flex flex-col justify-between">
                            <div>
                                {/* BANNER NẾU ĐÃ ĐĂNG NHẬP */}
                                {isAuthenticated && (
                                    <div className="mb-6 p-4 rounded-2xl bg-blue-50/80 border border-blue-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-bold text-blue-900 flex items-center gap-2">
                                                <span className="text-base">👋</span>
                                                <span>Đang đăng nhập: <strong>{user?.full_name || user?.username}</strong></span>
                                            </div>
                                            <span className="text-[10px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                {getRoleTitle(user?.role, user?.guest_profile?.vip_tier)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-blue-700 mb-3">
                                            {isStaffRole(user)
                                                ? 'Tài khoản nhân sự / quản lý của bạn đã đăng nhập thành công. Bạn có thể truy cập ngay vào Bàn làm việc Quản trị.'
                                                : 'Quý khách đã đăng nhập vào hệ thống. Bạn có thể quay về trang chủ hoặc đăng xuất để đổi tài khoản.'}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {isStaffRole(user) && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/admin')}
                                                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <span>⚙️ Cổng Quản Trị</span>
                                                    <span>→</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => navigate('/')}
                                                className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition cursor-pointer"
                                            >
                                                Về Trang Chủ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleLogoutCurrent}
                                                className="px-4 py-2 text-xs font-bold bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                            >
                                                Đăng xuất
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
                                {errorMessage && (
                                    <div className="mb-5 p-3.5 bg-rose-50/90 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5 animate-fadeIn">
                                        <span className="text-base shrink-0">⚠️</span>
                                        <span className="flex-1 font-medium leading-relaxed">{errorMessage}</span>
                                    </div>
                                )}
                                {successMessage && (
                                    <div className="mb-5 p-3.5 bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-start gap-2.5 animate-fadeIn">
                                        <span className="text-base shrink-0">✅</span>
                                        <span className="flex-1 font-medium leading-relaxed">{successMessage}</span>
                                    </div>
                                )}

                                {/* BỘ CHUYỂN TAB (TAB SWITCHER) HIỆN ĐẠI, DỊU MẮT */}
                                <div className="flex p-1.5 bg-slate-100/90 rounded-2xl mb-7 border border-slate-200/60">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('login');
                                            setErrorMessage(null);
                                        }}
                                        className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                                            activeTab === 'login'
                                                ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        Đăng Nhập
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('register');
                                            setErrorMessage(null);
                                        }}
                                        className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                            activeTab === 'register'
                                                ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <span>Đăng Ký Tài Khoản</span>
                                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                            Mới
                                        </span>
                                    </button>
                                </div>

                                {/* 1. FORM ĐĂNG NHẬP */}
                                {activeTab === 'login' && (
                                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Tên đăng nhập, Email hoặc Số điện thoại <span className="text-amber-600">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    required
                                                    value={loginForm.identifier}
                                                    onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                                                    placeholder="Tên đăng nhập, email hoặc số điện thoại"
                                                    className="w-full pl-11 pr-4 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                                />
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-xs font-bold text-slate-700">
                                                    Mật khẩu truy cập <span className="text-amber-600">*</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => alert('Vui lòng liên hệ lễ tân hoặc kiểm tra email/SMS để nhận mã khôi phục mật khẩu.')}
                                                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold cursor-pointer"
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
                                                    className="w-full pl-11 pr-11 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                                />
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                                >
                                                    {showPassword ? (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between py-1">
                                            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span>Ghi nhớ đăng nhập trên thiết bị này</span>
                                            </label>
                                        </div>

                                        {/* Nút Submit Đăng Nhập Sang Trọng */}
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isLoading && (
                                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                            <span>{isLoading ? 'Đang xác thực bảo mật...' : 'Đăng Nhập Tài Khoản'}</span>
                                            {!isLoading && <span>→</span>}
                                        </button>
                                    </form>
                                )}

                                {/* 2. FORM ĐĂNG KÝ */}
                                {activeTab === 'register' && (
                                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Họ và tên khách lưu trú <span className="text-amber-600">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={registerForm.fullName}
                                                onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                                                placeholder="Nguyễn Văn A (theo CCCD / Hộ chiếu)"
                                                className="w-full px-4 py-2.5 sm:py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Số điện thoại <span className="text-amber-600">*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    required
                                                    value={registerForm.phone}
                                                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                                                    placeholder="0901 234 567"
                                                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Địa chỉ Email <span className="text-amber-600">*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={registerForm.email}
                                                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                                    placeholder="vidu@email.com"
                                                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Thiết lập mật khẩu <span className="text-amber-600">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    minLength={8}
                                                    value={registerForm.password}
                                                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                                                    placeholder="Tối thiểu 8 ký tự"
                                                    className="w-full px-4 pr-11 py-2.5 sm:py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                                >
                                                    {showPassword ? (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="py-1">
                                            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 leading-relaxed select-none">
                                                <input
                                                    type="checkbox"
                                                    required
                                                    checked={registerForm.agreeTerms}
                                                    onChange={(e) => setRegisterForm({ ...registerForm, agreeTerms: e.target.checked })}
                                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                                />
                                                <span>
                                                    Tôi đồng ý với <a href="#dieu-khoan" className="text-blue-600 font-semibold hover:underline">Điều khoản dịch vụ</a> và <a href="#bao-mat" className="text-blue-600 font-semibold hover:underline">Chính sách bảo mật</a> của {hotelName}.
                                                </span>
                                            </label>
                                        </div>

                                        {/* Nút Submit Đăng Ký */}
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isLoading && (
                                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                            <span>{isLoading ? 'Đang khởi tạo tài khoản...' : 'Hoàn Tất Đăng Ký Tài Khoản'}</span>
                                            {!isLoading && <span>→</span>}
                                        </button>
                                    </form>
                                )}

                                {/* ĐĂNG NHẬP NHANH VỚI BIỂU TƯỢNG SVG CHUẨN */}
                                <div className="mt-7">
                                    <div className="relative flex items-center justify-center mb-5">
                                        <div className="border-t border-slate-200 w-full" />
                                        <span className="bg-white px-3 text-[11px] text-slate-400 uppercase font-bold tracking-wider absolute">
                                            Hoặc đăng nhập nhanh qua
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => alert('Đang kết nối cổng Google Account...')}
                                            className="py-2.5 px-3 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs cursor-pointer group"
                                        >
                                            <svg className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                            </svg>
                                            <span>Google</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => alert('Đang kết nối Apple ID...')}
                                            className="py-2.5 px-3 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs cursor-pointer group"
                                        >
                                            <svg className="w-4 h-4 fill-slate-900 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 170 170">
                                                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.7-11.71-13.97-5.55-8.48-9.87-18.06-12.96-28.74-3.09-10.68-4.64-21.08-4.64-31.2 0-14.57 3.69-26.69 11.08-36.37 7.39-9.68 16.89-14.61 28.5-14.79 4.35 0 9.27 1.09 14.75 3.28 5.48 2.19 9.38 3.38 11.71 3.57 1.95-.25 5.96-1.48 12.02-3.68 6.06-2.21 11.28-3.23 15.66-3.09 13.04.62 23.51 5.34 31.42 14.15-11.3 6.84-16.82 16.27-16.55 28.3.27 9.42 3.86 17.26 10.77 23.51 6.91 6.25 15.15 9.87 24.71 10.86-2.17 6.42-4.79 12.71-7.86 18.87zM119.22 31.84c0-7.23 2.62-13.93 7.86-20.1 5.24-6.17 11.74-10.08 19.5-11.74.54 3.91.46 7.69-.24 11.34-.7 3.65-2.07 7.15-4.11 10.51-4.08 6.53-9.97 10.4-17.67 11.62-.97-.54-2.18-.89-3.64-1.05-.98-.16-1.55-.35-1.7-.58z"/>
                                            </svg>
                                            <span>Apple ID</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => alert('Mã OTP xác thực đã được gửi về số điện thoại của quý khách.')}
                                            className="py-2.5 px-3 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs cursor-pointer group"
                                        >
                                            <svg className="w-4 h-4 text-emerald-600 shrink-0 group-hover:scale-105 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <span>Mã OTP</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* CHÂN FORM: BẢO MẬT SSL & HOTLINE */}
                            <div className="mt-7 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                                <div className="flex items-center gap-1.5 font-medium">
                                    <span className="text-emerald-500">🔒</span>
                                    <span>Bảo mật dữ liệu 256-bit SSL</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span>Hỗ trợ Concierge:</span>
                                    <strong className="text-slate-800">{hotline}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 3 BƯỚC TRẢI NGHIỆM TIỆN ÍCH KHI CÓ TÀI KHOẢN (GIAO DIỆN SÁNG, DỊU MẮT) */}
            <section className="py-16 bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            Trải Nghiệm Liền Mạch
                        </span>
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
                            Tiện ích vượt trội của tài khoản hội viên {hotelName}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-2">
                            Toàn bộ lịch sử hành trình và quyền lợi của quý khách được đồng bộ tự động, an toàn và sẵn sàng phục vụ 24/7.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                        <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl p-7 border border-slate-200/90 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg font-bold mb-5 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                                01
                            </div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-2">
                                Đặt phòng tức thì trong 30 giây
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                Tự động điền họ tên, CCCD, thói quen kê thêm gối nệm và ưu tiên tầng cao mà không cần nhập lại mỗi chuyến đi.
                            </p>
                        </div>

                        <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl p-7 border border-slate-200/90 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-lg font-bold mb-5 shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                                02
                            </div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-2">
                                Tra cứu mã voucher & hóa đơn VAT
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                Xuất trình mã xác nhận Booking ID ngay trên điện thoại khi đến quầy check-in và tải hóa đơn điện tử về máy bất kỳ lúc nào.
                            </p>
                        </div>

                        <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl p-7 border border-slate-200/90 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-lg font-bold mb-5 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                                03
                            </div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-2">
                                Dịch vụ chăm sóc quản gia ưu tiên
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                Đặt xe Mercedes đón sân bay, set trà chiều hoàng gia hay yêu cầu trang trí phòng trăng mật được quản gia xác nhận ưu tiên.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CÂU HỎI THƯỜNG GẶP (FAQ) & BANNER DOANH NGHIỆP */}
            <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
                    {/* FAQ Accordion */}
                    <div className="lg:col-span-7 space-y-4">
                        <div>
                            <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                Giải đáp thắc mắc
                            </span>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-2.5 mb-6">
                                Câu hỏi thường gặp về tài khoản đặt phòng
                            </h2>
                        </div>
                        <div className="space-y-3">
                            {faqs.map((faq, idx) => (
                                <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition">
                                    <button
                                        type="button"
                                        onClick={() => setActiveFaq(activeFaq === idx ? -1 : idx)}
                                        className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-blue-600 transition cursor-pointer"
                                    >
                                        <span>{faq.q}</span>
                                        <span className="text-slate-400 font-bold text-lg shrink-0">
                                            {activeFaq === idx ? '−' : '+'}
                                        </span>
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

                    {/* Banner Khách Hàng Doanh Nghiệp */}
                    <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-7 sm:p-8 text-white shadow-xl flex flex-col justify-between border border-white/10">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-wider mb-4 border border-blue-400/20">
                                <span>🏢</span>
                                <span>Dành Cho Doanh Nghiệp & Đoàn M.I.C.E</span>
                            </div>
                            <h3 className="font-serif text-xl sm:text-2xl font-bold leading-tight mb-3">
                                Chương Trình Hội Viên Doanh Nghiệp {hotelName} Corporate
                            </h3>
                            <p className="text-slate-300 text-xs leading-relaxed mb-6 font-light">
                                Chính sách chiết khấu phòng hội nghị, buồng phòng cao cấp và hợp đồng thanh toán công nợ chuyên biệt dành cho quý đối tác và doanh nghiệp.
                            </p>
                        </div>
                        <div className="space-y-4 pt-5 border-t border-white/10">
                            <div className="text-xs">
                                <span className="text-slate-400 block text-[11px] mb-0.5">Hotline hỗ trợ đoàn & công ty:</span>
                                <strong className="text-amber-300 text-base">{hotline} (Phím 2)</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/corporate-booking')}
                                className="w-full py-3 bg-white hover:bg-slate-100 text-blue-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                            >
                                <span>Đăng Ký Đặt Phòng Đoàn & Doanh Nghiệp</span>
                                <span>→</span>
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