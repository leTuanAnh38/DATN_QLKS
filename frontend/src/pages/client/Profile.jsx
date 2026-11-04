import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    User,
    Award,
    ShieldCheck,
    KeyRound,
    Lock,
    LogOut,
    Camera,
    CheckCircle2,
    AlertCircle,
    Calendar,
    MapPin,
    Mail,
    Phone,
    Heart,
    Sparkles,
    Ticket,
    History,
    Edit3,
    X,
    ChevronRight,
    CreditCard,
    Globe,
    UserCheck,
    ArrowRight
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ChangePasswordModal from '../../components/auth/ChangePasswordModal';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { isStaffRole, getRoleTitle } from '../../utils/permission';
import MembershipCard from '../../components/client/MembershipCard';

// Helper chuẩn hóa đường dẫn avatar từ backend
const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
        return avatar;
    }
    const backendBase = 'http://localhost:8000';
    return `${backendBase}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
};

// Helper định dạng ngày tháng sang dd/mm/yyyy
const formatDateVN = (dateStr) => {
    if (!dateStr) return 'Chưa cập nhật';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

export default function Profile() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated, logout } = useAuth();
    const fileInputRef = useRef(null);

    // Tab đang chọn: 'info' | 'membership'
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(location.search);
        const t = params.get('tab');
        if (t === 'membership') return t;
        return 'info';
    });

    // Modal state
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    // Chế độ chỉnh sửa thông tin: false = Chế độ xem, true = Đang chỉnh sửa
    const [isEditing, setIsEditing] = useState(false);

    // Form fields state
    const [formData, setFormData] = useState({
        fullName: '',
        phoneNumber: '',
        email: '',
        address: '',
        idType: 'CCCD',
        idCardNumber: '',
        dateOfBirth: '',
        gender: 'Nam',
        nationality: 'Việt Nam',
        preferences: '',
    });

    // Avatar upload preview state
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [removeAvatar, setRemoveAvatar] = useState(false);

    // Loading & feedback states
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    // Tải dữ liệu hồ sơ mới nhất từ máy chủ khi vào trang
    useEffect(() => {
        if (isAuthenticated) {
            authService.getProfile();
        }
    }, [isAuthenticated]);

    // Điền dữ liệu user vào form khi load
    useEffect(() => {
        if (user) {
            setFormData({
                fullName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
                phoneNumber: user.phone_number || '',
                email: user.email || '',
                address: user.address || '',
                idType: user.guest_profile?.id_type || user.id_type || 'CCCD',
                idCardNumber: user.guest_profile?.id_card_number || user.id_card_number || user.identity_card || '',
                dateOfBirth: user.guest_profile?.date_of_birth || user.date_of_birth || '',
                gender: user.guest_profile?.gender || user.gender || 'Nam',
                nationality: user.guest_profile?.nationality || user.nationality || 'Việt Nam',
                preferences: user.guest_profile?.preferences || user.preferences || '',
            });
            setAvatarPreview(getAvatarUrl(user.avatar));
            setAvatarFile(null);
            setRemoveAvatar(false);
        }
    }, [user]);

    // Hủy bỏ chỉnh sửa và khôi phục dữ liệu ban đầu
    const handleCancelEdit = () => {
        setIsEditing(false);
        setErrorMessage(null);
        if (user) {
            setFormData({
                fullName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
                phoneNumber: user.phone_number || '',
                email: user.email || '',
                address: user.address || '',
                idType: user.guest_profile?.id_type || user.id_type || 'CCCD',
                idCardNumber: user.guest_profile?.id_card_number || user.id_card_number || user.identity_card || '',
                dateOfBirth: user.guest_profile?.date_of_birth || user.date_of_birth || '',
                gender: user.guest_profile?.gender || user.gender || 'Nam',
                nationality: user.guest_profile?.nationality || user.nationality || 'Việt Nam',
                preferences: user.guest_profile?.preferences || user.preferences || '',
            });
            setAvatarPreview(getAvatarUrl(user.avatar));
            setAvatarFile(null);
            setRemoveAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Tạo chữ viết tắt Avatar nếu không có ảnh
    const getInitials = (name) => {
        if (!name) return 'TA';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    // Xử lý khi người dùng chọn file ảnh từ máy
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Chuyển sang tab thông tin và mở chế độ chỉnh sửa
        setActiveTab('info');
        if (!isEditing) setIsEditing(true);

        // Kiểm tra dung lượng (tối đa 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setErrorMessage('Kích thước ảnh không được vượt quá 5MB.');
            return;
        }

        // Kiểm tra định dạng ảnh
        if (!file.type.startsWith('image/')) {
            setErrorMessage('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP).');
            return;
        }

        setErrorMessage(null);
        setAvatarFile(file);
        setRemoveAvatar(false);

        // Tạo preview URL tức thì
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    // Đặt lại avatar về mặc định
    const handleResetToDefaultAvatar = () => {
        if (!isEditing) setIsEditing(true);
        setAvatarFile(null);
        setAvatarPreview(null);
        setRemoveAvatar(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Xử lý đăng xuất tài khoản
    const handleLogout = () => {
        setIsLogoutConfirmOpen(false);
        logout();
        navigate('/login');
    };

    // Xử lý nộp form cập nhật
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMessage(null);
        setErrorMessage(null);
        setIsLoading(true);

        try {
            const payload = new FormData();
            payload.append('full_name', formData.fullName);
            payload.append('phone_number', formData.phoneNumber);
            payload.append('email', formData.email);
            payload.append('address', formData.address);
            payload.append('id_type', formData.idType || 'CCCD');
            payload.append('id_card_number', formData.idCardNumber || '');
            payload.append('identity_card', formData.idCardNumber || '');
            payload.append('date_of_birth', formData.dateOfBirth || '');
            payload.append('gender', formData.gender || 'Nam');
            payload.append('nationality', formData.nationality || 'Việt Nam');
            payload.append('preferences', formData.preferences || '');

            if (avatarFile) {
                payload.append('avatar', avatarFile);
            } else if (removeAvatar) {
                payload.append('remove_avatar', 'true');
            }

            const result = await authService.updateProfile(payload);
            setIsLoading(false);

            if (result.success) {
                setSuccessMessage('Hồ sơ cá nhân và ảnh đại diện đã được cập nhật thành công!');
                setAvatarFile(null);
                setRemoveAvatar(false);
                setIsEditing(false); // Trở về chế độ xem sau khi lưu thành công
                if (result.user) {
                    setFormData({
                        fullName: result.user.full_name || `${result.user.first_name || ''} ${result.user.last_name || ''}`.trim() || result.user.username || '',
                        phoneNumber: result.user.phone_number || '',
                        email: result.user.email || '',
                        address: result.user.address || '',
                        idType: result.user.guest_profile?.id_type || result.user.id_type || 'CCCD',
                        idCardNumber: result.user.guest_profile?.id_card_number || result.user.id_card_number || result.user.identity_card || '',
                        dateOfBirth: result.user.guest_profile?.date_of_birth || result.user.date_of_birth || '',
                        gender: result.user.guest_profile?.gender || result.user.gender || 'Nam',
                        nationality: result.user.guest_profile?.nationality || result.user.nationality || 'Việt Nam',
                        preferences: result.user.guest_profile?.preferences || result.user.preferences || '',
                    });
                }
                setTimeout(() => setSuccessMessage(null), 4000);
            } else {
                setErrorMessage(result.message || 'Cập nhật thất bại. Vui lòng kiểm tra lại thông tin.');
            }
        } catch {
            setIsLoading(false);
            setErrorMessage('Đã xảy ra sự cố khi lưu hồ sơ. Vui lòng thử lại sau.');
        }
    };

    // Nếu chưa đăng nhập
    if (!isAuthenticated && !user) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
                <Navbar />
                <div className="max-w-xl mx-auto my-20 p-8 bg-white rounded-3xl shadow-xl text-center border border-slate-200">
                    <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl">
                        👑
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-slate-900 mb-2">
                        Quản Lý Hồ Sơ Khách Hàng
                    </h2>
                    <p className="text-slate-600 text-sm mb-6">
                        Quý khách vui lòng đăng nhập tài khoản để xem thông tin hội viên, đổi mật khẩu và quản lý hồ sơ cá nhân.
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/30 transition duration-200"
                    >
                        <span>🔑 Đăng nhập ngay</span>
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    const tierName = user?.current_tier?.name || user?.guest_profile?.vip_tier || 'Đồng (Bronze)';
    const totalPoints = (user?.total_points ?? user?.guest_profile?.loyalty_points ?? 0);

    return (
        <div className="min-h-screen bg-slate-50/60 flex flex-col justify-between selection:bg-amber-100 selection:text-amber-900">
            <Navbar />

            {/* 1. BREADCRUMB THANH ĐIỀU HƯỚNG */}
            <div className="bg-slate-100/80 border-b border-slate-200/60 py-2.5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold">Tài khoản & Hồ sơ</span>
                    </nav>
                </div>
            </div>

            {/* 2. HEADER TIÊU ĐỀ & ĐIỀU HƯỚNG */}
            <header className="bg-white border-b border-slate-200/80 pt-6 pb-2 shadow-2xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                Hồ Sơ Của Tôi
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Quản lý thông tin định danh, tùy chọn kỳ nghỉ và đặc quyền hội viên khách sạn TA.
                            </p>
                        </div>

                        {isStaffRole(user) && (
                            <Link
                                to="/admin"
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition flex items-center gap-1.5 self-start sm:self-auto"
                            >
                                <span>Vào Bàn Quản Trị</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        )}
                    </div>

                    {/* TAB NAVIGATION BAR (2 TABS GỌN GÀNG) */}
                    <div className="flex items-center gap-2 border-t border-slate-100 mt-5 pt-3 overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('info');
                                navigate('/profile?tab=info', { replace: true });
                            }}
                            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'info'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <User className="w-4 h-4" />
                            <span>Thông Tin Cá Nhân & Tài Khoản</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('membership');
                                navigate('/profile?tab=membership', { replace: true });
                            }}
                            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'membership'
                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <Award className="w-4 h-4" />
                            <span>Thẻ Hội Viên & Điểm Thưởng</span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                                activeTab === 'membership' ? 'bg-amber-700/80 text-white' : 'bg-amber-100 text-amber-800'
                            }`}>
                                {tierName}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* 3. MAIN TAB CONTENT */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
                {/* Alerts Feedback */}
                {successMessage && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs animate-fadeIn">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="font-semibold flex-1">{successMessage}</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs animate-fadeIn">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span className="font-semibold flex-1">{errorMessage}</span>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 1: THÔNG TIN CÁ NHÂN & SỞ THÍCH                                        */}
                {/* ========================================================================= */}
                {activeTab === 'info' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* CỘT TRÁI (4 CỘT): AVATAR & TỔNG QUAN TÀI KHOẢN */}
                        <div className="lg:col-span-4 space-y-6">
                            {/* Card Avatar */}
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700" />

                                <div className="relative z-10 -mt-2 flex flex-col items-center">
                                    <div className="relative group">
                                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-2xl transition-transform duration-300 group-hover:scale-105">
                                            {avatarPreview ? (
                                                <img
                                                    src={avatarPreview}
                                                    alt={formData.fullName || 'Avatar'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span>{getInitials(formData.fullName || user?.username)}</span>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!isEditing) setIsEditing(true);
                                                fileInputRef.current?.click();
                                            }}
                                            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition transform hover:scale-110"
                                            title="Thay đổi ảnh đại diện"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <h3 className="font-bold text-slate-900 text-base sm:text-lg mt-3">
                                        {formData.fullName || user?.username}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-full">
                                        {user?.email || 'Tài khoản khách hàng TA'}
                                    </p>

                                    {/* Action Buttons for Avatar */}
                                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!isEditing) setIsEditing(true);
                                                fileInputRef.current?.click();
                                            }}
                                            className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                            <span>Chọn ảnh mới</span>
                                        </button>

                                        {isEditing && (avatarPreview || user?.avatar) && (
                                            <button
                                                type="button"
                                                onClick={handleResetToDefaultAvatar}
                                                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                                            >
                                                Về mặc định
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-2">
                                        Hỗ trợ JPG, PNG, WEBP (tối đa 5MB)
                                    </span>
                                </div>

                                {/* Trạng thái bảo mật hồ sơ */}
                                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-left text-xs">
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-slate-500 flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Số điện thoại:</span>
                                        </span>
                                        {formData.phoneNumber ? (
                                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 text-[10px] flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Đã liên kết
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 text-[10px]">
                                                Chưa có
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-slate-500 flex items-center gap-1.5">
                                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                            <span>CCCD / Passport:</span>
                                        </span>
                                        {formData.idCardNumber ? (
                                            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60 text-[10px] flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Đã cập nhật
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 text-[10px]">
                                                Chưa cập nhật
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-slate-500 flex items-center gap-1.5">
                                            <Award className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Hạng hội viên:</span>
                                        </span>
                                        <span className="font-bold text-slate-800">
                                            {tierName}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Tiện ích tài khoản & Thao tác nhanh */}
                            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-1.5">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                                    Cài đặt & Tiện ích
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('membership')}
                                    className="w-full p-2.5 rounded-xl hover:bg-amber-50/60 text-slate-700 hover:text-amber-800 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Award className="w-4 h-4 text-amber-600" />
                                        <span>Thẻ Hội Viên & Điểm Tích Lũy</span>
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsChangePasswordOpen(true)}
                                    className="w-full p-2.5 rounded-xl hover:bg-blue-50/60 text-slate-700 hover:text-blue-700 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Lock className="w-4 h-4 text-blue-600" />
                                        <span>Đổi Mật Khẩu Đăng Nhập</span>
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <Link
                                    to="/booking-history"
                                    className="w-full p-2.5 rounded-xl hover:bg-indigo-50/60 text-slate-700 hover:text-indigo-700 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <History className="w-4 h-4 text-indigo-600" />
                                        <span>Lịch Sử Đặt Phòng & Tra Cứu</span>
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                                <Link
                                    to="/promotions"
                                    className="w-full p-2.5 rounded-xl hover:bg-purple-50/60 text-slate-700 hover:text-purple-700 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Ticket className="w-4 h-4 text-purple-600" />
                                        <span>Mã Giảm Giá Của Tôi</span>
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                                <div className="pt-1 border-t border-slate-100 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsLogoutConfirmOpen(true)}
                                        className="w-full p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <LogOut className="w-4 h-4 text-rose-500" />
                                            <span>Đăng Xuất Tài Khoản</span>
                                        </span>
                                        <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* CỘT PHẢI (8 CỘT): THÔNG TIN ĐỊNH DANH (VIEW & EDIT FORM) */}
                        <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
                            {/* Card Header with Quick Edit Trigger Button */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-6 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                            {isEditing ? 'Chỉnh Sửa Hồ Sơ Cá Nhân' : 'Hồ Sơ Định Danh & Liên Hệ'}
                                        </h2>
                                        {isEditing ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                Đang chỉnh sửa
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                Chế độ xem
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {isEditing
                                            ? 'Cập nhật thông tin chính xác giúp quá trình nhận phòng lễ tân diễn ra nhanh chóng.'
                                            : 'Thông tin cá nhân dùng để đối chiếu khi nhận phòng tại khách sạn TA Đà Nẵng.'}
                                    </p>
                                </div>

                                {/* Nút Chỉnh sửa ở ngay góc trên bên phải */}
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Chỉnh Sửa Hồ Sơ</span>
                                    </button>
                                )}
                            </div>

                            {/* CHẾ ĐỘ XEM (VIEW MODE) - GIAO DIỆN SẠCH SẼ, SANG TRỌNG */}
                            {!isEditing ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Họ và tên */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                    Họ và tên
                                                </span>
                                                <span className="font-bold text-slate-900 text-sm block mt-0.5 truncate">
                                                    {formData.fullName || 'Chưa cập nhật'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Số điện thoại */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                                                <Phone className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                        Số điện thoại
                                                    </span>
                                                    {formData.phoneNumber && (
                                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                                            Đã liên kết
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-slate-900 text-sm block mt-0.5 font-mono">
                                                    {formData.phoneNumber || 'Chưa cập nhật'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Email */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                        Địa chỉ Email
                                                    </span>
                                                    {formData.email && (
                                                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/60">
                                                            Đã xác minh
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-slate-900 text-sm block mt-0.5 truncate">
                                                    {formData.email || 'Chưa cập nhật'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Giấy tờ định danh */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                                                <CreditCard className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                    {formData.idType === 'PASSPORT' ? 'Hộ chiếu (Passport)' : 'Căn cước công dân (CCCD)'}
                                                </span>
                                                <span className="font-bold text-slate-900 text-sm block mt-0.5 font-mono">
                                                    {formData.idCardNumber || 'Chưa cập nhật'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Ngày sinh */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                    Ngày sinh
                                                </span>
                                                <span className="font-bold text-slate-900 text-sm block mt-0.5 font-sans tabular-nums">
                                                    {formatDateVN(formData.dateOfBirth)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Giới tính */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 shrink-0">
                                                <UserCheck className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                    Giới tính & Quốc tịch
                                                </span>
                                                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                                                    {formData.gender || 'Nam'} • {formData.nationality || 'Việt Nam'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Địa chỉ thường trú */}
                                        <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                    Địa chỉ thường trú / Thành phố
                                                </span>
                                                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                                                    {formData.address || 'Chưa cập nhật địa chỉ thường trú'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Khối Sở Thích Lưu Trú */}
                                    <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-amber-50/30 border border-amber-200/70">
                                        <div className="flex items-center gap-2 mb-2 text-amber-900 font-bold text-sm">
                                            <Heart className="w-4 h-4 text-amber-600 fill-amber-500" />
                                            <span>Sở thích & Yêu cầu phòng đặc biệt</span>
                                        </div>
                                        <p className="text-xs text-slate-700 leading-relaxed italic bg-white/80 p-3 rounded-xl border border-amber-200/50">
                                            &ldquo;{formData.preferences || 'Chưa có ghi chú sở thích. Quý khách có thể ghi chú loại gối mềm, phòng tầng cao, view biển hoặc lưu ý ăn uống để đội ngũ khách sạn phục vụ chu đáo nhất.'}&rdquo;
                                        </p>
                                        <span className="text-[11px] text-amber-800/80 mt-2 block">
                                            ✨ Đội ngũ quản gia khách sạn TA luôn sẵn sàng chuẩn bị phòng chu đáo nhất theo sở thích riêng của quý khách.
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* CHẾ ĐỘ CHỈNH SỬA (EDIT FORM) */
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Họ và tên */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Họ và tên đầy đủ <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.fullName}
                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                                placeholder="Ví dụ: Nguyễn Văn An"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                        </div>

                                        {/* Số điện thoại */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Số điện thoại di động <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={formData.phoneNumber}
                                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                                placeholder="Ví dụ: 0912345678"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition font-mono"
                                            />
                                        </div>

                                        {/* Email */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Địa chỉ Email <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="email@example.com"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                        </div>

                                        {/* Loại giấy tờ & Số CCCD / Passport */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Giấy tờ định danh
                                            </label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={formData.idType}
                                                    onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                                                    className="w-32 px-2.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition cursor-pointer"
                                                >
                                                    <option value="CCCD">CCCD / CMND</option>
                                                    <option value="PASSPORT">Hộ chiếu</option>
                                                    <option value="OTHER">Khác</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={formData.idCardNumber}
                                                    onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value })}
                                                    placeholder="Nhập số giấy tờ"
                                                    className="flex-1 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition font-mono"
                                                />
                                            </div>
                                        </div>

                                        {/* Ngày sinh */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Ngày sinh
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.dateOfBirth}
                                                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition cursor-pointer"
                                            />
                                        </div>

                                        {/* Giới tính */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Giới tính
                                            </label>
                                            <select
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition cursor-pointer"
                                            >
                                                <option value="Nam">Nam</option>
                                                <option value="Nữ">Nữ</option>
                                                <option value="Khác">Khác</option>
                                            </select>
                                        </div>

                                        {/* Quốc tịch */}
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Quốc tịch
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.nationality}
                                                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                                placeholder="Ví dụ: Việt Nam"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                        </div>

                                        {/* Địa chỉ thường trú */}
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Địa chỉ thường trú / Thành phố
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                            />
                                        </div>

                                        {/* Sở thích lưu trú */}
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Sở thích & Yêu cầu lưu trú đặc biệt
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={formData.preferences}
                                                onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
                                                placeholder="Ví dụ: Thích phòng tầng cao, gối lông vũ mềm, không hút thuốc, đồ ăn ít đường..."
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition resize-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Bottom Form Actions */}
                                    <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                        <span className="text-xs text-slate-400">
                                            Các trường có dấu <span className="text-rose-500 font-bold">*</span> là bắt buộc.
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                disabled={isLoading}
                                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition cursor-pointer disabled:opacity-60"
                                            >
                                                Hủy bỏ
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-70 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-orange-500/20 transition flex items-center gap-2 cursor-pointer"
                                            >
                                                {isLoading && (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                )}
                                                <span>{isLoading ? 'Đang lưu...' : 'Lưu Thay Đổi Hồ Sơ'}</span>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: THẺ HỘI VIÊN & ĐIỂM THƯỞNG (LOYALTY CLUB)                            */}
                {/* ========================================================================= */}
                {activeTab === 'membership' && (
                    <div className="space-y-8 animate-fadeIn">
                        {/* Virtual ATM Card Component */}
                        <MembershipCard user={user} />

                        {/* Thẻ hướng dẫn quyền lợi hội viên */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Card 1: Quy chế tích điểm */}
                            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                                            <Award className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-base">
                                            Chính Sách Tích Lũy Điểm
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Mỗi <strong>100.000 VNĐ</strong> thanh toán đặt phòng hoặc dịch vụ thành công tại Khách Sạn TA Đà Nẵng, quý khách sẽ được tích lũy <strong>1 điểm (pts)</strong>.
                                    </p>
                                    <div className="mt-4 space-y-2 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span>Điểm thưởng tích lũy tự động sau khi trả phòng (Check-out).</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span>Điểm được bảo lưu vĩnh viễn và dùng để thăng hạng thẻ tự động.</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span>Thăng hạng thẻ mở khóa chiết khấu phòng trực tiếp vào hóa đơn.</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Tích thêm điểm ngay:</span>
                                    <Link
                                        to="/rooms"
                                        className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <span>Đặt phòng kỳ nghỉ</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>

                            {/* Card 2: Lối tắt ưu đãi */}
                            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                                            <Ticket className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-base">
                                            Voucher & Ưu Đãi Dành Riêng
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Hội viên Khách sạn TA được hưởng kho voucher đặc quyền, ưu tiên nhận phòng sớm khi phòng sạch và giảm giá dịch vụ ăn uống F&B.
                                    </p>
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Ưu đãi phòng</span>
                                            <strong className="text-slate-900 font-bold text-sm mt-0.5 block">
                                                Giảm đến 15%
                                            </strong>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lễ tân đón tiếp</span>
                                            <strong className="text-purple-700 font-bold text-sm mt-0.5 block">
                                                VIP Concierge
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Xem danh sách voucher:</span>
                                    <Link
                                        to="/promotions"
                                        className="text-purple-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <span>Khám phá ưu đãi</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <Footer />

            {/* Modal Đổi Mật Khẩu */}
            <ChangePasswordModal
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />

            {/* Modal Xác Nhận Đăng Xuất */}
            {isLogoutConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                            <LogOut className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">
                                Đăng xuất tài khoản?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Quý khách có chắc chắn muốn đăng xuất khỏi tài khoản khách sạn TA không?
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsLogoutConfirmOpen(false)}
                                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                            >
                                Ở lại
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
                            >
                                Đăng xuất
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
