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
    Ticket,
    History,
    Edit3,
    X,
    ChevronRight,
    CreditCard,
    Globe,
    UserCheck,
    ArrowRight,
    Crown,
    LogIn
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ChangePasswordModal from '../../components/auth/ChangePasswordModal';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { isStaffRole, getRoleTitle } from '../../utils/permission';
import MembershipCard from '../../components/client/MembershipCard';
import { resolveMediaUrl } from '../../utils/mediaUrl';

// Helper chuẩn hóa đường dẫn avatar từ backend
const getAvatarUrl = (avatar) => resolveMediaUrl(avatar, null);

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
                    <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                        <Crown className="w-8 h-8" />
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-slate-900 mb-2">
                        Quản Lý Hồ Sơ Khách Hàng
                    </h2>
                    <p className="text-slate-600 text-sm mb-6">
                        Quý khách vui lòng đăng nhập tài khoản để xem thông tin hội viên, đổi mật khẩu và quản lý hồ sơ cá nhân.
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-900/20 transition duration-200"
                    >
                        <LogIn className="w-4 h-4" />
                        <span>Đăng nhập ngay</span>
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
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 whitespace-nowrap overflow-x-auto no-scrollbar">
                        <Link to="/" className="hover:text-sky-600 transition shrink-0">Trang chủ</Link>
                        <span className="text-slate-300 shrink-0">/</span>
                        <span className="text-slate-900 font-semibold truncate min-w-0">Tài khoản & Hồ sơ</span>
                    </nav>
                </div>
            </div>

            {/* 2. HEADER TIÊU ĐỀ & ĐIỀU HƯỚNG */}
            <header className="bg-white border-b border-slate-200/80 pt-6 pb-2 shadow-2xs relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div>
                           
                            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
                                Hồ Sơ Của Tôi
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Quản lý thông tin định danh, tùy chọn kỳ nghỉ và đặc quyền hội viên khách sạn TA.
                            </p>
                        </div>

                        {isStaffRole(user) && (
                            <Link
                                to="/admin"
                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white shadow-md shadow-sky-900/15 transition flex items-center gap-1.5 self-start sm:self-auto"
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
                                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20'
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
                                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <Award className="w-4 h-4 text-amber-500" />
                            <span>Thẻ Hội Viên & Điểm Thưởng</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                activeTab === 'membership'
                                    ? 'bg-amber-400/20 text-amber-200 border-amber-300/40'
                                    : 'bg-amber-50 text-amber-800 border-amber-200/80'
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
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-x-8 lg:gap-y-6 items-start">
                        {/* 1. THẺ AVATAR & TỔNG QUAN TÀI KHOẢN (Mobile: Vị trí 1, Desktop: Cột trái hàng 1) */}
                        <div className="lg:col-span-4 lg:col-start-1 lg:row-start-1">
                            {/* Card Avatar */}
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 text-center relative overflow-hidden">
                                {/* Dải nền Xanh Biển Pastel dịu mắt, thanh lịch */}
                                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-sky-100/90 via-blue-50/80 to-cyan-100/90 border-b border-sky-200/50 overflow-hidden">
                                    <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-sky-300/25 blur-2xl pointer-events-none" />
                                    <div className="absolute -bottom-8 -left-6 w-24 h-24 rounded-full bg-cyan-300/25 blur-xl pointer-events-none" />
                                </div>

                                <div className="relative z-10 mt-1 flex flex-col items-center">
                                    <div className="relative group">
                                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-tr from-sky-600 via-blue-600 to-cyan-700 flex items-center justify-center text-white font-bold text-2xl transition-transform duration-300 group-hover:scale-105">
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
                                            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition transform hover:scale-110"
                                            title="Thay đổi ảnh đại diện"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <h3 className="font-serif font-bold text-slate-900 text-lg sm:text-xl mt-3">
                                        {formData.fullName || user?.username}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-full">
                                        {user?.email || 'Tài khoản khách hàng TA'}
                                    </p>

                                    {/* Huy hiệu Hạng Hội Viên nổi bật ngay dưới tên */}
                                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 via-yellow-50/80 to-amber-50 border border-amber-200/80 shadow-2xs">
                                        <Award className="w-3.5 h-3.5 text-amber-600" />
                                        <span className="text-[11px] font-extrabold tracking-wide text-amber-900">
                                            Hội viên {tierName}
                                        </span>
                                    </div>

                                    {/* Action Buttons for Avatar */}
                                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!isEditing) setIsEditing(true);
                                                fileInputRef.current?.click();
                                            }}
                                            className="px-3.5 py-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/60 rounded-xl transition cursor-pointer flex items-center gap-1.5"
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
                                    <div className="flex items-center justify-between py-1 gap-2">
                                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Số điện thoại:</span>
                                        </span>
                                        {(formData.phoneNumber?.trim() || user?.phone_number?.trim() || user?.phone?.trim()) ? (
                                            <span className="font-bold text-slate-800 font-mono text-xs truncate max-w-[170px]" title={formData.phoneNumber || user?.phone_number || user?.phone}>
                                                {formData.phoneNumber?.trim() || user?.phone_number?.trim() || user?.phone?.trim()}
                                            </span>
                                        ) : (
                                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 text-[10px] font-medium shrink-0">
                                                Chưa cập nhật
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between py-1 gap-2">
                                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                            <span>CCCD / Passport:</span>
                                        </span>
                                        {(formData.idCardNumber?.trim() || user?.guest_profile?.id_card_number?.trim() || user?.id_card_number?.trim() || user?.identity_card?.trim()) ? (
                                            <span className="font-bold text-slate-800 font-mono text-xs truncate max-w-[170px]" title={formData.idCardNumber || user?.guest_profile?.id_card_number || user?.id_card_number || user?.identity_card}>
                                                {formData.idCardNumber?.trim() || user?.guest_profile?.id_card_number?.trim() || user?.id_card_number?.trim() || user?.identity_card?.trim()}
                                            </span>
                                        ) : (
                                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 text-[10px] font-medium shrink-0">
                                                Chưa cập nhật
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-slate-500 flex items-center gap-1.5">
                                            <Award className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Điểm tích lũy:</span>
                                        </span>
                                        <span className="font-bold text-slate-800">
                                            {totalPoints.toLocaleString('vi-VN')} pts
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. CỘT PHẢI - THÔNG TIN ĐỊNH DANH (VIEW & EDIT FORM) */}
                        {/* Trên mobile hiển thị vị trí 2 (ngay dưới Avatar), trên desktop hiển thị cột phải */}
                        <div className="lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:row-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 min-w-0">
                            {/* Card Header with Quick Edit Trigger Button */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-6 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                                            {isEditing ? 'Chỉnh Sửa Hồ Sơ Cá Nhân' : 'Hồ Sơ Định Danh & Liên Hệ'}
                                        </h2>
                                        {isEditing ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                Đang chỉnh sửa
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/70">
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
                                        className="self-start sm:self-auto px-4 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/15 transition flex items-center gap-1.5 cursor-pointer shrink-0"
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
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-sky-200/80 transition-colors flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
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
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-sky-200/80 transition-colors flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
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
                                                {formData.phoneNumber ? (
                                                    <span className="font-bold text-slate-900 text-sm block mt-0.5 font-mono">
                                                        {formData.phoneNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs block mt-0.5">
                                                        Chưa cập nhật số điện thoại
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Email */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-sky-200/80 transition-colors flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                        Địa chỉ Email
                                                    </span>
                                                    {formData.email && (
                                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
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
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-sky-200/80 transition-colors flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                                <CreditCard className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                    {formData.idType === 'PASSPORT' ? 'Hộ chiếu (Passport)' : 'Căn cước công dân (CCCD)'}
                                                </span>
                                                {formData.idCardNumber ? (
                                                    <span className="font-bold text-slate-900 text-sm block mt-0.5 font-mono">
                                                        {formData.idCardNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs block mt-0.5">
                                                        Chưa cập nhật giấy tờ
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ngày sinh */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-sky-200/80 transition-colors flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                        Ngày sinh
                                                    </span>
                                                    {!formData.dateOfBirth && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditing(true)}
                                                            className="text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                                                        >
                                                            + Bổ sung
                                                        </button>
                                                    )}
                                                </div>
                                                {formData.dateOfBirth ? (
                                                    <span className="font-bold text-slate-900 text-sm block mt-0.5 font-sans tabular-nums">
                                                        {formatDateVN(formData.dateOfBirth)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs block mt-0.5">
                                                        Chưa cập nhật (Nhận ưu đãi sinh nhật)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Giới tính */}
                                        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-sky-200/80 transition-colors flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
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
                                        <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 hover:border-sky-200/80 transition-colors flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                                    Địa chỉ thường trú / Thành phố
                                                </span>
                                                {formData.address ? (
                                                    <span className="font-bold text-slate-900 text-sm block mt-0.5">
                                                        {formData.address}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs block mt-0.5">
                                                        Chưa cập nhật địa chỉ thường trú
                                                    </span>
                                                )}
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
                                        <span className="text-[11px] text-amber-800/80 mt-2 flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            <span>Đội ngũ quản gia khách sạn TA luôn sẵn sàng chuẩn bị phòng chu đáo nhất theo sở thích riêng của quý khách.</span>
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* CHẾ ĐỘ CHỈNH SỬA (EDIT FORM) */
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Họ và tên */}
                                        <div className="min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Họ và tên đầy đủ <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.fullName}
                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                                placeholder="Ví dụ: Nguyễn Văn An"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition"
                                            />
                                        </div>

                                        {/* Số điện thoại */}
                                        <div className="min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Số điện thoại di động <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={formData.phoneNumber}
                                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                                placeholder="Ví dụ: 0912345678"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition font-mono"
                                            />
                                        </div>

                                        {/* Email */}
                                        <div className="min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Địa chỉ Email <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="email@example.com"
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition"
                                            />
                                        </div>

                                        {/* Loại giấy tờ & Số CCCD / Passport */}
                                        <div className="min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Giấy tờ định danh
                                            </label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={formData.idType}
                                                    onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                                                    className="w-32 px-2.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition cursor-pointer"
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
                                                    className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition font-mono"
                                                />
                                            </div>
                                        </div>

                                        {/* Ngày sinh */}
                                        <div className="min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Ngày sinh
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.dateOfBirth}
                                                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                                className="w-full min-w-0 max-w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition cursor-pointer"
                                            />
                                        </div>

                                        {/* Giới tính */}
                                        <div className="min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Giới tính
                                            </label>
                                            <select
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                className="w-full min-w-0 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition cursor-pointer"
                                            >
                                                <option value="Nam">Nam</option>
                                                <option value="Nữ">Nữ</option>
                                                <option value="Khác">Khác</option>
                                            </select>
                                        </div>

                                        {/* Quốc tịch */}
                                        <div className="sm:col-span-2 min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Quốc tịch
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.nationality}
                                                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                                placeholder="Ví dụ: Việt Nam"
                                                className="w-full min-w-0 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition"
                                            />
                                        </div>

                                        {/* Địa chỉ thường trú */}
                                        <div className="sm:col-span-2 min-w-0">
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Địa chỉ thường trú / Thành phố
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh"
                                                className="w-full min-w-0 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition"
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
                                                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/15 focus:bg-white transition resize-none"
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
                                                className="px-6 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 disabled:opacity-70 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-sky-900/20 transition flex items-center gap-2 cursor-pointer"
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

                        {/* 3. CỘT TRÁI - CARD CÀI ĐẶT & TIỆN ÍCH TÀI KHOẢN */}
                        {/* Trên mobile hiển thị vị trí 3 (cuối trang), trên desktop hiển thị cột trái hàng 2 ngay dưới Avatar */}
                        <div className="lg:col-span-4 lg:col-start-1 lg:row-start-2">
                            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-1.5">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                                    Cài đặt & Tiện ích
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('membership')}
                                    className="w-full p-2.5 rounded-xl hover:bg-amber-50/70 text-slate-700 hover:text-amber-800 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Award className="w-4 h-4 text-amber-500" />
                                        <span>Thẻ Hội Viên & Điểm Tích Lũy</span>
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsChangePasswordOpen(true)}
                                    className="w-full p-2.5 rounded-xl hover:bg-sky-50/70 text-slate-700 hover:text-sky-700 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Lock className="w-4 h-4 text-sky-600" />
                                        <span>Đổi Mật Khẩu Đăng Nhập</span>
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <Link
                                    to="/booking-history"
                                    className="w-full p-2.5 rounded-xl hover:bg-sky-50/70 text-slate-700 hover:text-sky-700 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <History className="w-4 h-4 text-sky-600" />
                                        <span>Lịch Sử Đặt Phòng & Tra Cứu</span>
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                                <Link
                                    to="/promotions"
                                    className="w-full p-2.5 rounded-xl hover:bg-sky-50/70 text-slate-700 hover:text-sky-700 transition flex items-center justify-between text-xs font-semibold cursor-pointer group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Ticket className="w-4 h-4 text-sky-600" />
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
                                        <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                                            <Award className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-serif font-bold text-slate-900 text-lg">
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
                                        className="text-sky-600 hover:text-sky-700 font-bold hover:underline flex items-center gap-1"
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
                                        <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                                            <Ticket className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-serif font-bold text-slate-900 text-lg">
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
                                            <strong className="text-sky-700 font-bold text-sm mt-0.5 block">
                                                VIP Concierge
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Xem danh sách voucher:</span>
                                    <Link
                                        to="/promotions"
                                        className="text-sky-600 hover:text-sky-700 font-bold hover:underline flex items-center gap-1"
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
