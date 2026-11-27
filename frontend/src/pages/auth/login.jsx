import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    User,
    Lock,
    Eye,
    EyeOff,
    Mail,
    Phone,
    MapPin,
    Users,
    Award,
    Crown,
    UserCheck,
    Search,
    Zap,
    FileText,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Building2,
    ChevronDown,
    ChevronRight,
    ArrowRight,
    ShieldCheck,
    Star,
    LogOut,
    LayoutDashboard,
    Clock,
    Calendar,
    X
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { isStaffRole, getRoleTitle } from '../../utils/permission';
import { useHotelSettings, DEFAULT_BANNERS } from '../../store/hotelSettingStore';
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal';
import Reveal from '../../components/common/Reveal';
import { resolveMediaUrl } from '../../utils/mediaUrl';

// Đánh giá độ mạnh mật khẩu nhẹ cho tab Đăng ký
const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200', textColor: 'text-slate-400' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) score += 1;
    if (score <= 1) return { score: 1, label: 'Yếu', color: 'bg-rose-500', textColor: 'text-rose-600' };
    if (score === 2) return { score: 2, label: 'Trung bình', color: 'bg-amber-500', textColor: 'text-amber-600' };
    if (score === 3) return { score: 3, label: 'Khá mạnh', color: 'bg-sky-500', textColor: 'text-sky-600' };
    return { score: 4, label: 'Rất mạnh', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
};

// Helper chuẩn hóa URL hình ảnh (hỗ trợ cả link tuyệt đối và file upload local media)
const resolveBannerUrl = (url) => resolveMediaUrl(url, '');
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

const formatDemoDate = (offsetDays) => {
    const date = new Date(Date.now() + offsetDays * 86400000);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

const ensureGoogleOAuthLoaded = () =>
    new Promise((resolve, reject) => {
        if (window.google?.accounts?.oauth2) {
            resolve(window.google.accounts.oauth2);
            return;
        }
        const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        const checkReady = () => {
            if (window.google?.accounts?.oauth2) {
                resolve(window.google.accounts.oauth2);
                return true;
            }
            return false;
        };
        if (existingScript) {
            let elapsed = 0;
            const timer = setInterval(() => {
                if (checkReady()) {
                    clearInterval(timer);
                } else if ((elapsed += 100) >= 6000) {
                    clearInterval(timer);
                    reject(new Error('Không thể tải dịch vụ đăng nhập Google. Vui lòng thử lại.'));
                }
            }, 100);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (!checkReady()) {
                reject(new Error('Dịch vụ đăng nhập Google chưa sẵn sàng.'));
            }
        };
        script.onerror = () => reject(new Error('Không thể kết nối tới Google Identity Services.'));
        document.head.appendChild(script);
    });

export default function AuthBookingPage() {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const { settings } = useHotelSettings();

    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const starCount = settings?.stars || 3;
    const hotline = settings?.hotline || '1900 8899';
    const bannerLoginUrl = resolveBannerUrl(settings?.banner_login || DEFAULT_BANNERS?.banner_login || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2070&q=85');

    const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [loginErrors, setLoginErrors] = useState({});
    const [registerErrors, setRegisterErrors] = useState({});
    const [legalModal, setLegalModal] = useState(null); // 'terms' | 'privacy' | null
    const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

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
        confirmPassword: '',
        agreeTerms: true
    });

    // Accordion FAQ state
    const [activeFaq, setActiveFaq] = useState(0);

    const demoCheckIn = formatDemoDate(7);
    const demoCheckOut = formatDemoDate(10);
    const passwordStrength = getPasswordStrength(registerForm.password);

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
        },
        {
            q: 'Chính sách tích điểm hội viên và nâng hạng phòng áp dụng thế nào?',
            a: 'Ngay khi hoàn tất đăng ký tài khoản, mỗi kỳ nghỉ của quý khách sẽ được tích lũy điểm thưởng từ 5% - 10% giá trị hóa đơn. Điểm tích lũy có thể dùng để khấu trừ tiền phòng, nhận bữa sáng buffet miễn phí hoặc ưu tiên nhận phòng sớm / trả phòng muộn.'
        }
    ];

    const mapServerFieldErrors = (errorsObj, mode) => {
        if (!errorsObj || typeof errorsObj !== 'object') return {};
        const pickFirst = (val) => (Array.isArray(val) ? val[0] : val);
        const mapped = {};
        if (mode === 'login') {
            if (errorsObj.identifier || errorsObj.username || errorsObj.email) {
                mapped.identifier = pickFirst(errorsObj.identifier || errorsObj.username || errorsObj.email);
            }
            if (errorsObj.password) mapped.password = pickFirst(errorsObj.password);
        } else {
            if (errorsObj.fullName || errorsObj.full_name) {
                mapped.fullName = pickFirst(errorsObj.fullName || errorsObj.full_name);
            }
            if (errorsObj.phone || errorsObj.phone_number) {
                mapped.phone = pickFirst(errorsObj.phone || errorsObj.phone_number);
            }
            if (errorsObj.email) mapped.email = pickFirst(errorsObj.email);
            if (errorsObj.password) mapped.password = pickFirst(errorsObj.password);
        }
        return mapped;
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        const nextErrors = {};
        if (!loginForm.identifier.trim()) {
            nextErrors.identifier = 'Vui lòng nhập tên đăng nhập, email hoặc số điện thoại.';
        }
        if (!loginForm.password) {
            nextErrors.password = 'Vui lòng nhập mật khẩu truy cập.';
        }
        if (Object.keys(nextErrors).length > 0) {
            setLoginErrors(nextErrors);
            return;
        }
        setLoginErrors({});
        setIsLoading(true);

        const result = await authService.login(loginForm.identifier.trim(), loginForm.password, {
            remember: rememberMe,
        });
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
            const serverMapped = mapServerFieldErrors(result.errors, 'login');
            if (Object.keys(serverMapped).length > 0) {
                setLoginErrors(serverMapped);
            }
            setErrorMessage(result.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        const nextErrors = {};
        const cleanName = registerForm.fullName.trim();
        const cleanPhone = registerForm.phone.replace(/[\s.-]/g, '').trim();
        const cleanEmail = registerForm.email.trim();

        if (cleanName.length < 2) {
            nextErrors.fullName = 'Vui lòng nhập họ và tên đầy đủ (tối thiểu 2 ký tự).';
        }
        if (!/^(0|\+84)[3-9]\d{8}$/.test(cleanPhone)) {
            nextErrors.phone = 'Số điện thoại Việt Nam chưa hợp lệ (VD: 0901234567).';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            nextErrors.email = 'Địa chỉ email không đúng định dạng.';
        }
        if (!registerForm.password || registerForm.password.length < 8) {
            nextErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
        }
        if (!registerForm.confirmPassword) {
            nextErrors.confirmPassword = 'Vui lòng nhập lại mật khẩu để xác nhận.';
        } else if (registerForm.confirmPassword !== registerForm.password) {
            nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
        }
        if (!registerForm.agreeTerms) {
            nextErrors.agreeTerms = 'Quý khách cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setRegisterErrors(nextErrors);
            return;
        }
        setRegisterErrors({});
        setIsLoading(true);

        const result = await authService.register({
            fullName: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            password: registerForm.password,
        });
        setIsLoading(false);

        if (result.success) {
            setSuccessMessage(result.data?.message || 'Đăng ký tài khoản thành công! Đang chuyển hướng về trang chủ...');
            setTimeout(() => {
                navigate('/');
            }, 800);
        } else {
            const serverMapped = mapServerFieldErrors(result.errors, 'register');
            if (Object.keys(serverMapped).length > 0) {
                setRegisterErrors(serverMapped);
            }
            setErrorMessage(result.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.');
        }
    };

    const handleLogoutCurrent = async () => {
        await authService.logout();
        setSuccessMessage('Đã đăng xuất tài khoản thành công.');
        setErrorMessage(null);
    };

    const handleGoogleLogin = async () => {
        if (!GOOGLE_CLIENT_ID) {
            setErrorMessage('Chức năng đăng nhập bằng Google chưa được cấu hình.');
            return;
        }
        setErrorMessage(null);
        setSuccessMessage(null);
        setIsGoogleLoading(true);
        try {
            const oauth2 = await ensureGoogleOAuthLoaded();
            const tokenClient = oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'openid email profile',
                callback: async (tokenResponse) => {
                    if (!tokenResponse?.access_token) {
                        setIsGoogleLoading(false);
                        setErrorMessage(tokenResponse?.error_description || 'Không nhận được xác thực từ Google.');
                        return;
                    }
                    const result = await authService.googleLogin(
                        { access_token: tokenResponse.access_token },
                        { remember: rememberMe }
                    );
                    setIsGoogleLoading(false);
                    if (result.success) {
                        const loggedInUser = result.data?.user;
                        const isStaff = isStaffRole(loggedInUser);
                        setSuccessMessage(result.data?.message || 'Đăng nhập bằng Google thành công!');
                        setTimeout(() => {
                            navigate(isStaff ? '/admin' : '/');
                        }, 700);
                    } else {
                        setErrorMessage(result.message || 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.');
                    }
                },
                error_callback: (err) => {
                    setIsGoogleLoading(false);
                    if (err?.type === 'popup_failed_to_open') {
                        setErrorMessage('Trình duyệt đã chặn cửa sổ bật lên của Google. Vui lòng cho phép popup và thử lại.');
                    }
                },
            });
            tokenClient.requestAccessToken({ prompt: 'select_account' });
        } catch (err) {
            setIsGoogleLoading(false);
            setErrorMessage(err?.message || 'Không thể tải cổng đăng nhập Google. Vui lòng thử lại.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-500 selection:text-white flex flex-col">
            {/* Reusable Navbar */}
            <Navbar />

            {/* BREADCRUMB */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-amber-600 transition font-medium">Trang chủ</Link>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-900 font-semibold">Tài khoản & Đặt phòng</span>
                    </nav>
                </div>
            </div>

            {/* MAIN AUTH SECTION (CHUẨN RESORT LUXURY VỚI LUXURY MOTION) */}
            <main className="relative py-6 sm:py-12 lg:py-16 overflow-hidden flex items-center bg-slate-950 border-b border-slate-800">
                {/* 1. Ảnh nền Resort phóng chậm Ken Burns mượt mà */}
                <img
                    src={bannerLoginUrl}
                    alt={`${hotelName} Luxury Collection`}
                    className="animate-ken-burns absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* 2. Lớp phủ Gradient sâu lắng, dịu mắt với tone slate hoàng gia */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/86 to-slate-950/92 backdrop-blur-[1.5px]" />

                {/* Ánh sáng nền khuếch tán chuyển động êm (GPU-composited) */}
                <div className="animate-ambient-drift absolute top-1/4 left-10 w-96 h-96 bg-amber-500/12 rounded-full blur-3xl pointer-events-none" />
                <div className="animate-ambient-drift-reverse absolute bottom-10 right-10 w-96 h-96 bg-sky-500/12 rounded-full blur-3xl pointer-events-none" />

                {/* 3. Nội dung form & thông tin relative z-10 */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 lg:gap-10 items-stretch">
                        
                        {/* CỘT TRÁI: QUẢN LÝ KỲ NGHỈ & THẺ VÉ VIP MOCKUP */}
                        <div
                            className="animate-hero-up order-2 lg:order-1 lg:col-span-6 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 sm:p-9 text-white shadow-2xl flex flex-col justify-between relative overflow-hidden"
                            style={{ animationDelay: '130ms' }}
                        >
                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10.5px] sm:text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4 shadow-xs max-w-full">
                                    <Award className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                    <span className="leading-snug">Cổng Hội Viên Khách Hàng Thân Thiết</span>
                                </div>
                                <h1 className="font-serif text-xl sm:text-4xl font-bold leading-tight mb-2 sm:mb-3">
                                    Quản lý kỳ nghỉ dễ dàng &amp; tiện lợi
                                </h1>
                                <p className="text-slate-300/90 text-xs sm:text-sm font-light leading-relaxed mb-4 sm:mb-6">
                                    Đăng nhập để xem lịch sử lưu trú, lưu sẵn thông tin check-in, nhận ưu đãi độc quyền dành cho hội viên và thay đổi lịch trình linh hoạt.
                                </p>

                                {/* MOCKUP BOOKING CONFIRMATION TICKET (ẨN TRÊN MOBILE NHỎ ĐỂ TRÁNH DÀI TRANG) */}
                                <div className="hidden sm:block bg-gradient-to-b from-white/12 to-white/5 backdrop-blur-md border border-white/15 hover:border-amber-300/30 rounded-2xl p-5 mb-6 shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                    {/* Họa tiết ánh sáng hổ phách */}
                                    <div className="absolute top-0 right-0 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

                                    {/* Header vé */}
                                    <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
                                            <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                                                Xác Nhận Đặt Phòng Trực Tuyến
                                            </span>
                                        </div>
                                        <span className="font-mono text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-md font-bold text-[11px] border border-amber-400/20">
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
                                                <div className="text-[11px] text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                                                    <span>Tầng 18</span>
                                                    <span>•</span>
                                                    <span>View Trực Diện Biển Mỹ Khê</span>
                                                    <span>•</span>
                                                    <span className="flex items-center text-amber-400">
                                                        {[...Array(starCount)].map((_, i) => (
                                                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                        ))}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs bg-black/30 p-3 rounded-xl border border-white/5">
                                            <div>
                                                <span className="text-slate-400 flex items-center gap-1.5 text-[10px] uppercase font-semibold">
                                                    <Calendar className="w-3 h-3 text-amber-400" />
                                                    Nhận phòng (Check-in)
                                                </span>
                                                <strong className="text-slate-100 text-[12px] block mt-1">14:00 - {demoCheckIn}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 flex items-center gap-1.5 text-[10px] uppercase font-semibold">
                                                    <Clock className="w-3 h-3 text-orange-400" />
                                                    Trả phòng (Check-out)
                                                </span>
                                                <strong className="text-slate-100 text-[12px] block mt-1">12:00 - {demoCheckOut} (3 đêm)</strong>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                                            <span className="flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-amber-300" />
                                                <span>Số khách: <strong className="text-white">2 Người lớn</strong></span>
                                            </span>
                                            <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                                <Crown className="w-3 h-3 text-amber-300" /> VIP Club Lounge Access
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer vé */}
                                    <div className="bg-white/5 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10">
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                            <span>{hotelName} • Bãi biển Mỹ Khê</span>
                                        </span>
                                        <span className="text-amber-300/90 font-semibold px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20">
                                            Thẻ minh họa hội viên
                                        </span>
                                    </div>
                                </div>

                                {/* 4 LỢI THẾ CỐT LÕI (Lưới 2 cột gọn trên cả Mobile & Desktop) */}
                                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                                    <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 bg-white/5 hover:bg-white/10 p-3 sm:p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                                            <Search className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <strong className="text-white block font-semibold text-[11.5px] sm:text-xs mb-0.5 leading-snug">Theo dõi 24/7</strong>
                                            <span className="text-slate-300 text-[10.5px] sm:text-[11px] leading-snug sm:leading-relaxed line-clamp-2">
                                                Tra cứu phòng, giờ check-in/out và chứng từ tức thời.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 bg-white/5 hover:bg-white/10 p-3 sm:p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
                                            <Zap className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <strong className="text-white block font-semibold text-[11.5px] sm:text-xs mb-0.5 leading-snug">Đặt phòng 1-chạm</strong>
                                            <span className="text-slate-300 text-[10.5px] sm:text-[11px] leading-snug sm:leading-relaxed line-clamp-2">
                                                Tự động điền hồ sơ, tiết kiệm tối đa thời gian.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 bg-white/5 hover:bg-white/10 p-3 sm:p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <strong className="text-white block font-semibold text-[11.5px] sm:text-xs mb-0.5 leading-snug">Hóa đơn VAT</strong>
                                            <span className="text-slate-300 text-[10.5px] sm:text-[11px] leading-snug sm:leading-relaxed line-clamp-2">
                                                Xuất hóa đơn GTGT nhanh chóng cho cơ quan, công tác.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 bg-white/5 hover:bg-white/10 p-3 sm:p-3.5 rounded-2xl border border-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                                            <RefreshCw className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <strong className="text-white block font-semibold text-[11.5px] sm:text-xs mb-0.5 leading-snug">Đổi lịch linh hoạt</strong>
                                            <span className="text-slate-300 text-[10.5px] sm:text-[11px] leading-snug sm:leading-relaxed line-clamp-2">
                                                Chủ động chuyển ngày hoặc gửi yêu cầu tiện ích phòng.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hotline chân cột trái (ẩn trên mobile để tránh lặp lại hotline dưới form) */}
                            <div className="relative z-10 pt-6 mt-6 border-t border-white/10 hidden lg:flex items-center justify-between text-xs text-slate-400">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400 animate-pulse" />
                                    <span>Hỗ trợ khách hàng trực tuyến 24/7</span>
                                </span>
                                <a href={`tel:${hotline.replace(/\s+/g, '')}`} className="text-amber-300 hover:text-white font-bold transition flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>Hotline: {hotline}</span>
                                </a>
                            </div>
                        </div>

                        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ SANG TRỌNG */}
                        <div
                            className="animate-hero-up order-1 lg:order-2 lg:col-span-6 bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/70 shadow-2xl p-4 sm:p-9 flex flex-col justify-between"
                            style={{ animationDelay: '50ms' }}
                        >
                            <div>
                                {/* Lời chào Serif tinh tế thay đổi mượt theo Tab */}
                                <div className="mb-4 sm:mb-5">
                                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                        {activeTab === 'login' ? 'Chào mừng quý khách trở lại' : 'Đăng ký hội viên TA Club'}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {activeTab === 'login'
                                            ? `Đăng nhập để quản lý đặt phòng và nhận ưu đãi tại ${hotelName}.`
                                            : 'Khởi tạo tài khoản nhanh để tích điểm và hưởng chiết khấu trực tiếp.'}
                                    </p>
                                </div>
                                {/* BANNER NẾU ĐÃ ĐĂNG NHẬP */}
                                {isAuthenticated && (
                                    <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2 min-w-0">
                                                <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span className="truncate">Đang đăng nhập: <strong>{user?.full_name || user?.username}</strong></span>
                                            </div>
                                            <span className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide shadow-xs shrink-0">
                                                {getRoleTitle(user?.role, user?.guest_profile?.vip_tier)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                                            {isStaffRole(user)
                                                ? 'Tài khoản nhân sự / quản lý của bạn đã đăng nhập thành công. Bạn có thể truy cập ngay vào Bàn làm việc Quản trị.'
                                                : 'Quý khách đã đăng nhập vào hệ thống. Bạn có thể quay về trang chủ hoặc đăng xuất để đổi tài khoản.'}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {isStaffRole(user) && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/admin')}
                                                    className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white rounded-xl transition shadow-md shadow-sky-900/20 cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <LayoutDashboard className="w-3.5 h-3.5" />
                                                    <span>Cổng Quản Trị</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
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
                                                className="px-4 py-2 text-xs font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                            >
                                                <LogOut className="w-3.5 h-3.5" />
                                                <span>Đăng xuất</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
                                {errorMessage && (
                                    <div className="mb-5 p-3.5 bg-rose-50/90 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5 animate-fadeIn">
                                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                        <span className="flex-1 font-medium leading-relaxed">{errorMessage}</span>
                                    </div>
                                )}
                                {successMessage && (
                                    <div className="mb-5 p-3.5 bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-start gap-2.5 animate-fadeIn">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span className="flex-1 font-medium leading-relaxed">{successMessage}</span>
                                    </div>
                                )}

                                {/* BỘ CHUYỂN TAB (SLIDING PILL MƯỢT MÀ) */}
                                <div className="relative grid grid-cols-2 p-1.5 bg-slate-100/90 rounded-2xl mb-5 sm:mb-6 border border-slate-200/60">
                                    <div
                                        aria-hidden="true"
                                        className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl bg-white shadow-sm shadow-slate-200/90 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none"
                                        style={{ transform: activeTab === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('login');
                                            setErrorMessage(null);
                                            setLoginErrors({});
                                            setRegisterErrors({});
                                        }}
                                        className={`relative z-10 min-h-[40px] sm:min-h-[42px] py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors duration-200 cursor-pointer ${
                                            activeTab === 'login'
                                                ? 'text-slate-900'
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
                                            setLoginErrors({});
                                            setRegisterErrors({});
                                        }}
                                        className={`relative z-10 min-h-[40px] sm:min-h-[42px] py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                            activeTab === 'register'
                                                ? 'text-slate-900'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <span>
                                            Đăng Ký<span className="hidden sm:inline"> Tài Khoản</span>
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200/50">
                                            Mới
                                        </span>
                                    </button>
                                </div>

                                {/* 1. FORM ĐĂNG NHẬP */}
                                {activeTab === 'login' && (
                                    <form key="login-tab" onSubmit={handleLoginSubmit} noValidate className="animate-tab-reveal space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Tên đăng nhập, Email hoặc Số điện thoại <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    required
                                                    value={loginForm.identifier}
                                                    onChange={(e) => {
                                                        setLoginForm({ ...loginForm, identifier: e.target.value });
                                                        if (loginErrors.identifier) setLoginErrors((prev) => ({ ...prev, identifier: '' }));
                                                    }}
                                                    placeholder="Tên đăng nhập, email hoặc số điện thoại"
                                                    className={`w-full pl-11 pr-4 py-3 border rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none ${
                                                        loginErrors.identifier
                                                            ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                                                            : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 focus:bg-white'
                                                    }`}
                                                />
                                                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${loginErrors.identifier ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-sky-600'}`}>
                                                    <User className="w-4 h-4" />
                                                </div>
                                            </div>
                                            {loginErrors.identifier && (
                                                <p className="mt-1.5 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{loginErrors.identifier}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-xs font-bold text-slate-700">
                                                    Mật khẩu truy cập <span className="text-rose-500">*</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsForgotPasswordOpen(true)}
                                                    className="py-1.5 px-1 -my-1.5 text-xs text-sky-700 hover:text-sky-800 hover:underline font-semibold cursor-pointer"
                                                >
                                                    Quên mật khẩu?
                                                </button>
                                            </div>
                                            <div className="relative group">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    value={loginForm.password}
                                                    onChange={(e) => {
                                                        setLoginForm({ ...loginForm, password: e.target.value });
                                                        if (loginErrors.password) setLoginErrors((prev) => ({ ...prev, password: '' }));
                                                    }}
                                                    placeholder="Nhập mật khẩu của quý khách"
                                                    className={`w-full pl-11 pr-11 py-3 border rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none ${
                                                        loginErrors.password
                                                            ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                                                            : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 focus:bg-white'
                                                    }`}
                                                />
                                                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${loginErrors.password ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-sky-600'}`}>
                                                    <Lock className="w-4 h-4" />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
                                                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="w-4 h-4" />
                                                    ) : (
                                                        <Eye className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                            {loginErrors.password && (
                                                <p className="mt-1.5 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{loginErrors.password}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between py-1">
                                            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 text-sky-600 accent-sky-600 focus:ring-sky-500 cursor-pointer"
                                                />
                                                <span>Ghi nhớ đăng nhập trên thiết bị này</span>
                                            </label>
                                        </div>

                                        {/* Nút Submit Đăng Nhập Sang Trọng */}
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="btn-luxury-shine group w-full py-3.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-900/20 hover:shadow-sky-500/30 ring-1 ring-inset ring-white/20 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isLoading && (
                                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                            <span>{isLoading ? 'Đang xác thực bảo mật...' : 'Đăng Nhập Tài Khoản'}</span>
                                            {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                                        </button>
                                    </form>
                                )}

                                {/* 2. FORM ĐĂNG KÝ */}
                                {activeTab === 'register' && (
                                    <form key="register-tab" onSubmit={handleRegisterSubmit} noValidate className="animate-tab-reveal space-y-3.5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Họ và tên khách lưu trú <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    required
                                                    value={registerForm.fullName}
                                                    onChange={(e) => {
                                                        setRegisterForm({ ...registerForm, fullName: e.target.value });
                                                        if (registerErrors.fullName) setRegisterErrors((prev) => ({ ...prev, fullName: '' }));
                                                    }}
                                                    placeholder="Nguyễn Văn A (theo CCCD / Hộ chiếu)"
                                                    className={`w-full pl-11 pr-4 py-2.5 sm:py-3 border rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none ${
                                                        registerErrors.fullName
                                                            ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                                                            : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 focus:bg-white'
                                                    }`}
                                                />
                                                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${registerErrors.fullName ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-sky-600'}`}>
                                                    <User className="w-4 h-4" />
                                                </div>
                                            </div>
                                            {registerErrors.fullName && (
                                                <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{registerErrors.fullName}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Số điện thoại <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type="tel"
                                                        required
                                                        value={registerForm.phone}
                                                        onChange={(e) => {
                                                            setRegisterForm({ ...registerForm, phone: e.target.value });
                                                            if (registerErrors.phone) setRegisterErrors((prev) => ({ ...prev, phone: '' }));
                                                        }}
                                                        placeholder="0901 234 567"
                                                        className={`w-full pl-11 pr-4 py-2.5 sm:py-3 border rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none ${
                                                            registerErrors.phone
                                                                ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                                                                : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 focus:bg-white'
                                                        }`}
                                                    />
                                                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${registerErrors.phone ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-sky-600'}`}>
                                                        <Phone className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                {registerErrors.phone && (
                                                    <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{registerErrors.phone}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Địa chỉ Email <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type="email"
                                                        required
                                                        value={registerForm.email}
                                                        onChange={(e) => {
                                                            setRegisterForm({ ...registerForm, email: e.target.value });
                                                            if (registerErrors.email) setRegisterErrors((prev) => ({ ...prev, email: '' }));
                                                        }}
                                                        placeholder="vidu@email.com"
                                                        className={`w-full pl-11 pr-4 py-2.5 sm:py-3 border rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none ${
                                                            registerErrors.email
                                                                ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                                                                : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 focus:bg-white'
                                                        }`}
                                                    />
                                                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${registerErrors.email ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-sky-600'}`}>
                                                        <Mail className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                {registerErrors.email && (
                                                    <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{registerErrors.email}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Thiết lập mật khẩu <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        required
                                                        minLength={8}
                                                        value={registerForm.password}
                                                        onChange={(e) => {
                                                            const nextPwd = e.target.value;
                                                            setRegisterForm({ ...registerForm, password: nextPwd });
                                                            setRegisterErrors((prev) => ({
                                                                ...prev,
                                                                password: '',
                                                                confirmPassword:
                                                                    registerForm.confirmPassword && nextPwd !== registerForm.confirmPassword
                                                                        ? 'Mật khẩu xác nhận không khớp.'
                                                                        : ''
                                                            }));
                                                        }}
                                                        placeholder="Tối thiểu 8 ký tự"
                                                        className={`w-full pl-11 pr-11 py-2.5 sm:py-3 border rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none ${
                                                            registerErrors.password
                                                                ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                                                                : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 focus:bg-white'
                                                        }`}
                                                    />
                                                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${registerErrors.password ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-sky-600'}`}>
                                                        <Lock className="w-4 h-4" />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
                                                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                                    >
                                                        {showPassword ? (
                                                            <EyeOff className="w-4 h-4" />
                                                        ) : (
                                                            <Eye className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                                {/* Thanh đo độ mạnh mật khẩu gọn nhẹ */}
                                                {registerForm.password.length > 0 && (
                                                    <div className="mt-1.5 flex items-center gap-2">
                                                        <div className="flex-1 grid grid-cols-4 gap-1">
                                                            {[1, 2, 3, 4].map((level) => (
                                                                <span
                                                                    key={level}
                                                                    className={`h-1 rounded-full transition-colors duration-300 ${
                                                                        level <= passwordStrength.score
                                                                            ? passwordStrength.color
                                                                            : 'bg-slate-200'
                                                                    }`}
                                                                />
                                                            ))}
                                                        </div>
                                                        <span className={`text-[10px] font-bold whitespace-nowrap ${passwordStrength.textColor}`}>
                                                            {passwordStrength.label}
                                                        </span>
                                                    </div>
                                                )}
                                                {registerErrors.password && (
                                                    <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{registerErrors.password}</span>
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Nhập lại mật khẩu <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        required
                                                        value={registerForm.confirmPassword}
                                                        onChange={(e) => {
                                                            const nextConfirm = e.target.value;
                                                            setRegisterForm({ ...registerForm, confirmPassword: nextConfirm });
                                                            setRegisterErrors((prev) => ({
                                                                ...prev,
                                                                confirmPassword:
                                                                    nextConfirm && nextConfirm !== registerForm.password
                                                                        ? 'Mật khẩu xác nhận không khớp.'
                                                                        : ''
                                                            }));
                                                        }}
                                                        placeholder="Xác nhận lại mật khẩu"
                                                        className={`w-full pl-11 pr-11 py-2.5 sm:py-3 border rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none ${
                                                            registerErrors.confirmPassword
                                                                ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                                                                : 'bg-slate-50/80 hover:bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 focus:bg-white'
                                                        }`}
                                                    />
                                                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${registerErrors.confirmPassword ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-sky-600'}`}>
                                                        <Lock className="w-4 h-4" />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
                                                        title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                                    >
                                                        {showConfirmPassword ? (
                                                            <EyeOff className="w-4 h-4" />
                                                        ) : (
                                                            <Eye className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                                {registerErrors.confirmPassword && (
                                                    <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{registerErrors.confirmPassword}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="py-1">
                                            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 leading-relaxed select-none">
                                                <input
                                                    type="checkbox"
                                                    required
                                                    checked={registerForm.agreeTerms}
                                                    onChange={(e) => {
                                                        setRegisterForm({ ...registerForm, agreeTerms: e.target.checked });
                                                        if (e.target.checked && registerErrors.agreeTerms) {
                                                            setRegisterErrors((prev) => ({ ...prev, agreeTerms: '' }));
                                                        }
                                                    }}
                                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 accent-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                                                />
                                                <span>
                                                    Tôi đồng ý với{' '}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setLegalModal('terms');
                                                        }}
                                                        className="text-sky-700 font-semibold hover:underline cursor-pointer"
                                                    >
                                                        Điều khoản dịch vụ
                                                    </button>{' '}
                                                    và{' '}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setLegalModal('privacy');
                                                        }}
                                                        className="text-sky-700 font-semibold hover:underline cursor-pointer"
                                                    >
                                                        Chính sách bảo mật
                                                    </button>{' '}
                                                    của {hotelName}.
                                                </span>
                                            </label>
                                            {registerErrors.agreeTerms && (
                                                <p className="mt-1.5 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{registerErrors.agreeTerms}</span>
                                                </p>
                                            )}
                                        </div>

                                        {/* Nút Submit Đăng Ký */}
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="btn-luxury-shine group w-full py-3.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-900/20 hover:shadow-sky-500/30 ring-1 ring-inset ring-white/20 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isLoading && (
                                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                            <span>{isLoading ? 'Đang khởi tạo tài khoản...' : 'Hoàn Tất Đăng Ký Tài Khoản'}</span>
                                            {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                                        </button>
                                    </form>
                                )}

                                {GOOGLE_CLIENT_ID && (
                                    <div className="mt-6">
                                        <div className="relative flex items-center justify-center mb-4">
                                            <div className="border-t border-slate-200 w-full" />
                                            <span className="bg-white px-3 text-[11px] text-slate-400 uppercase font-bold tracking-wider absolute">
                                                Hoặc tiếp tục với
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGoogleLogin}
                                            disabled={isLoading || isGoogleLoading}
                                            className="w-full py-3 px-4 border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 rounded-xl flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white transition shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
                                        >
                                            {isGoogleLoading ? (
                                                <svg className="animate-spin h-4 w-4 text-sky-600 shrink-0" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                                </svg>
                                            )}
                                            <span>{isGoogleLoading ? 'Đang xác thực với Google...' : 'Tiếp tục với Google'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* CHÂN FORM: BẢO MẬT SSL & HOTLINE */}
                            <div className="mt-7 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                                <div className="flex items-center gap-1.5 font-medium">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    <span>Bảo mật dữ liệu 256-bit SSL</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span>Hỗ trợ Concierge:</span>
                                    <strong className="text-amber-700 font-bold">{hotline}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 3 BƯỚC TRẢI NGHIỆM TIỆN ÍCH KHI CÓ TÀI KHOẢN (GIAO DIỆN SÁNG, DỊU MẮT) */}
            <section className="py-8 sm:py-14 bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Reveal className="text-center max-w-2xl mx-auto mb-6 sm:mb-10">
                        <span className="text-[11px] sm:text-xs uppercase font-extrabold tracking-widest text-amber-700 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200/80">
                            Trải Nghiệm Liền Mạch
                        </span>
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
                            Tiện ích vượt trội của tài khoản hội viên {hotelName}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-2">
                            Toàn bộ lịch sử hành trình và quyền lợi của quý khách được đồng bộ tự động, an toàn và sẵn sàng phục vụ 24/7.
                        </p>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6 lg:gap-8">
                        <Reveal delay={40} className="bg-gradient-to-b from-slate-50 to-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-slate-200/90 hover:border-sky-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex sm:block items-start gap-3.5 group">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-700 text-white flex items-center justify-center text-base sm:text-lg font-bold shrink-0 mb-0 sm:mb-5 shadow-md shadow-sky-900/15 group-hover:scale-105 transition-transform">
                                01
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-serif font-bold text-slate-900 text-sm sm:text-base mb-1 sm:mb-2">
                                    Đặt phòng tức thì trong 30 giây
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                    Tự động điền họ tên, CCCD, thói quen kê thêm gối nệm và ưu tiên tầng cao mà không cần nhập lại mỗi chuyến đi.
                                </p>
                            </div>
                        </Reveal>

                        <Reveal delay={110} className="bg-gradient-to-b from-slate-50 to-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-slate-200/90 hover:border-sky-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex sm:block items-start gap-3.5 group">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-700 text-white flex items-center justify-center text-base sm:text-lg font-bold shrink-0 mb-0 sm:mb-5 shadow-md shadow-sky-900/15 group-hover:scale-105 transition-transform">
                                02
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-serif font-bold text-slate-900 text-sm sm:text-base mb-1 sm:mb-2">
                                    Tra cứu mã voucher &amp; hóa đơn VAT
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                    Xuất trình mã xác nhận Booking ID ngay trên điện thoại khi đến quầy check-in và tải hóa đơn điện tử về máy bất kỳ lúc nào.
                                </p>
                            </div>
                        </Reveal>

                        <Reveal delay={180} className="bg-gradient-to-b from-slate-50 to-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-slate-200/90 hover:border-sky-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex sm:block items-start gap-3.5 group">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-700 text-white flex items-center justify-center text-base sm:text-lg font-bold shrink-0 mb-0 sm:mb-5 shadow-md shadow-sky-900/15 group-hover:scale-105 transition-transform">
                                03
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-serif font-bold text-slate-900 text-sm sm:text-base mb-1 sm:mb-2">
                                    Hỗ trợ dịch vụ &amp; lễ tân ưu tiên
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                    Hỗ trợ đặt xe đưa đón sân bay, gọi ẩm thực tại phòng hay yêu cầu chuẩn bị phòng kỷ niệm được lễ tân xác nhận ưu tiên.
                                </p>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* CÂU HỎI THƯỜNG GẶP (FAQ) & BANNER DOANH NGHIỆP */}
            <section className="py-8 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 items-start">
                    {/* FAQ Accordion */}
                    <Reveal className="lg:col-span-7 space-y-4">
                        <div>
                            <span className="text-[11px] sm:text-xs uppercase font-extrabold tracking-widest text-amber-700 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200/80">
                                Giải đáp thắc mắc
                            </span>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-2.5 mb-4 sm:mb-6">
                                Câu hỏi thường gặp về tài khoản đặt phòng
                            </h2>
                        </div>
                        <div className="space-y-2.5 sm:space-y-3">
                            {faqs.map((faq, idx) => (
                                <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-sky-300 transition-colors">
                                    <button
                                        type="button"
                                        onClick={() => setActiveFaq(activeFaq === idx ? -1 : idx)}
                                        className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-sky-700 transition cursor-pointer"
                                    >
                                        <span>{faq.q}</span>
                                        <ChevronDown
                                            className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                                                activeFaq === idx ? 'rotate-180 text-sky-600' : 'text-slate-400'
                                            }`}
                                        />
                                    </button>
                                    {activeFaq === idx && (
                                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-sky-50/25 animate-tab-reveal">
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Reveal>

                    {/* Banner Khách Hàng Doanh Nghiệp */}
                    <Reveal delay={100} className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 rounded-3xl p-5 sm:p-8 text-white shadow-2xl flex flex-col justify-between border border-sky-500/20 relative overflow-hidden">
                        {/* Glow trang trí chuyển động êm */}
                        <div className="animate-ambient-drift absolute top-0 right-0 w-48 h-48 bg-amber-500/12 rounded-full blur-2xl pointer-events-none" />

                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-3.5 sm:mb-4 border border-amber-400/30">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Dành Cho Doanh Nghiệp &amp; Đoàn M.I.C.E</span>
                            </div>
                            <h3 className="font-serif text-xl sm:text-2xl font-bold leading-tight mb-2.5 sm:mb-3">
                                Chương Trình Hội Viên Doanh Nghiệp {hotelName} Corporate
                            </h3>
                            <p className="text-slate-300 text-xs leading-relaxed mb-5 sm:mb-6 font-light">
                                Chính sách chiết khấu phòng hội nghị, buồng phòng cao cấp và hợp đồng thanh toán công nợ chuyên biệt dành cho quý đối tác và doanh nghiệp.
                            </p>
                        </div>
                        <div className="relative z-10 space-y-3.5 sm:space-y-4 pt-4 sm:pt-5 border-t border-white/10">
                            <div className="text-xs">
                                <span className="text-slate-400 block text-[11px] mb-0.5">Hotline hỗ trợ đoàn &amp; công ty:</span>
                                <strong className="text-amber-300 text-base">{hotline} (Phím 2)</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/corporate-booking')}
                                className="btn-luxury-shine group w-full py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-900/20 ring-1 ring-inset ring-white/20 transition cursor-pointer flex items-center justify-center gap-2"
                            >
                                <span>Đăng Ký Đặt Phòng Đoàn &amp; Doanh Nghiệp</span>
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* Modal Quên Mật Khẩu */}
            <ForgotPasswordModal
                isOpen={isForgotPasswordOpen}
                onClose={() => setIsForgotPasswordOpen(false)}
                onSuccess={(restoredEmail) => {
                    setActiveTab('login');
                    setLoginForm((prev) => ({
                        ...prev,
                        identifier: restoredEmail,
                        password: '',
                    }));
                    setSuccessMessage('Mật khẩu của quý khách đã được cập nhật thành công! Vui lòng nhập mật khẩu mới để đăng nhập.');
                }}
            />

            {/* Modal Điều Khoản & Bảo Mật */}
            {legalModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
                    onClick={() => setLegalModal(null)}
                >
                    <div
                        className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-100 animate-fadeIn max-h-[90dvh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 shrink-0">
                            <div className="min-w-0">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                                    {hotelName}
                                </span>
                                <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                                    {legalModal === 'terms' ? 'Điều Khoản Dịch Vụ Hội Viên' : 'Chính Sách Bảo Mật Thông Tin'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLegalModal(null)}
                                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                                aria-label="Đóng"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 py-4 space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed overflow-y-auto">
                            {legalModal === 'terms' ? (
                                <>
                                    <p>
                                        Khi đăng ký tài khoản hội viên tại <strong className="text-slate-800">{hotelName}</strong>, quý khách đồng ý cung cấp thông tin cá nhân chính xác để phục vụ việc đặt phòng, làm thủ tục nhận phòng và xuất hóa đơn theo quy định.
                                    </p>
                                    <p>
                                        • Chính sách đổi/hủy đặt phòng áp dụng theo từng hạng phòng và điều kiện của đơn đặt phòng cụ thể.
                                    </p>
                                    <p>
                                        • Điểm thưởng và ưu đãi hội viên chỉ có giá trị sử dụng trên hệ thống của {hotelName} và không có giá trị quy đổi thành tiền mặt.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>
                                        <strong className="text-slate-800">{hotelName}</strong> cam kết bảo mật tuyệt đối họ tên, số điện thoại, địa chỉ email và lịch sử lưu trú của quý khách.
                                    </p>
                                    <p>
                                        • Dữ liệu cá nhân chỉ được dùng để xác thực tài khoản, xử lý yêu cầu đặt phòng, hỗ trợ chăm sóc khách hàng và gửi thông báo liên quan đến kỳ nghỉ.
                                    </p>
                                    <p>
                                        • Chúng tôi không chia sẻ thông tin khách hàng cho bên thứ ba ngoài phạm vi phục vụ lưu trú hoặc yêu cầu hợp pháp của cơ quan chức năng.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setLegalModal(null)}
                                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer"
                            >
                                Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reusable Footer */}
            <Footer />
        </div>
    );
}