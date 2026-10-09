import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ChangePasswordModal from '../../components/auth/ChangePasswordModal';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { isStaffRole, getRoleTitle } from '../../utils/permission';

// Helper chuẩn hóa đường dẫn avatar từ backend
const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
        return avatar;
    }
    const backendBase = 'http://localhost:8000';
    return `${backendBase}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
};

export default function Profile() {
    const navigate = useNavigate();
    const { user, isAuthenticated, updateUser } = useAuth();
    const fileInputRef = useRef(null);

    // Modal state
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    // Chế độ chỉnh sửa: false = Chế độ xem, true = Đang chỉnh sửa
    const [isEditing, setIsEditing] = useState(false);

    // Form fields state
    const [formData, setFormData] = useState({
        fullName: '',
        phoneNumber: '',
        email: '',
        address: '',
        idCardNumber: '',
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
                idCardNumber: user.guest_profile?.id_card_number || user.id_card_number || user.identity_card || '',
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
                idCardNumber: user.guest_profile?.id_card_number || user.id_card_number || user.identity_card || '',
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

        // Tự động mở chế độ chỉnh sửa nếu đang ở chế độ xem
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
            payload.append('id_card_number', formData.idCardNumber || '');
            payload.append('identity_card', formData.idCardNumber || '');
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
                        idCardNumber: result.user.guest_profile?.id_card_number || result.user.id_card_number || result.user.identity_card || '',
                        preferences: result.user.guest_profile?.preferences || result.user.preferences || '',
                    });
                }
                // Tự ẩn thông báo sau 4 giây
                setTimeout(() => setSuccessMessage(null), 4000);
            } else {
                setErrorMessage(result.message || 'Cập nhật thất bại. Vui lòng kiểm tra lại thông tin.');
            }
        } catch (err) {
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

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-amber-100 selection:text-amber-900">
            <Navbar />

            {/* 1. BREADCRUMB THANH ĐIỀU HƯỚNG */}
            <div className="bg-slate-100/80 border-b border-slate-200/60 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold">Hồ sơ cá nhân & Tài khoản</span>
                    </nav>
                </div>
            </div>

            {/* 2. HEADER TIÊU ĐỀ */}
            <header className="bg-white border-b border-slate-100 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold uppercase tracking-wider">
                                    ✦ Trung tâm quản lý tài khoản
                                </span>
                                {user && (
                                    <span className="text-xs text-slate-500">
                                        {isStaffRole(user) ? 'Nhân sự / Quản lý: ' : 'Khách hàng: '}
                                        <strong>{user.full_name || user.username}</strong>
                                    </span>
                                )}
                            </div>
                            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                Hồ Sơ Của Tôi
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                                Quản lý thông tin định danh, tùy chọn kỳ nghỉ và cập nhật ảnh đại diện tài khoản.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {isStaffRole(user) ? (
                                <div className="flex items-center gap-2">
                                    <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                                        🛡️ {getRoleTitle(user?.role)}
                                    </span>
                                    <Link
                                        to="/admin"
                                        className="px-4 py-1.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                                    >
                                        Vào Bàn Quản Trị →
                                    </Link>
                                </div>
                            ) : (
                                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                                    ★ Hạng Hội Viên: {user?.guest_profile?.vip_tier || 'Silver Member'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* 2. MAIN PROFILE CONTAINER */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* CỘT BÊN TRÁI: CARD AVATAR & THẺ HỘI VIÊN (4 CỘT) */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Card Avatar & Tải ảnh đại diện */}
                        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700" />

                            {/* Avatar Display */}
                            <div className="relative z-10 -mt-2 flex flex-col items-center">
                                <div className="relative group">
                                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-3xl transition-transform duration-300 group-hover:scale-105">
                                        {avatarPreview ? (
                                            <img
                                                src={avatarPreview}
                                                alt={user?.full_name || 'Avatar'}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span>{getInitials(formData.fullName || user?.username)}</span>
                                        )}
                                    </div>

                                    {/* Camera badge trigger file upload */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!isEditing) setIsEditing(true);
                                            fileInputRef.current?.click();
                                        }}
                                        className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition transform hover:scale-110"
                                        title="Thay đổi ảnh đại diện"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/png, image/jpeg, image/webp, image/jpg"
                                    className="hidden"
                                />

                                <h2 className="font-serif font-bold text-slate-900 text-xl mt-4">
                                    {formData.fullName || user?.username}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {user?.email || user?.phone_number || 'Khách hàng VIP'}
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
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        <span>Tải ảnh lên</span>
                                    </button>

                                    {isEditing && (avatarPreview || user?.avatar) && (
                                        <button
                                            type="button"
                                            onClick={handleResetToDefaultAvatar}
                                            className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition cursor-pointer"
                                        >
                                            Về mặc định
                                        </button>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-2">
                                    Hỗ trợ JPG, PNG, WEBP (tối đa 5MB)
                                </span>
                            </div>

                            {/* Card Chi Tiết Thẻ Thành Viên */}
                            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 gap-3 text-left">
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Hạng thẻ</span>
                                    <span className="font-bold text-amber-600 text-sm flex items-center gap-1 mt-0.5">
                                        👑 {user?.guest_profile?.vip_tier || 'Silver'}
                                    </span>
                                </div>
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Điểm TA Club</span>
                                    <span className="font-bold text-blue-600 text-sm mt-0.5 block">
                                        {user?.guest_profile?.loyalty_points || 0} pts
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Card Menu Tiện Ích Nhanh */}
                        <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100 divide-y divide-slate-100">
                            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                                Tiện ích tài khoản
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsChangePasswordOpen(true)}
                                className="w-full py-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl px-2 transition text-left cursor-pointer"
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className="w-4 h-4 flex items-center justify-center text-blue-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                    </span>
                                    <span>Đổi mật khẩu tài khoản</span>
                                </span>
                                <span className="text-slate-400">›</span>
                            </button>
                            <Link
                                to="/promotions"
                                className="w-full py-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl px-2 transition text-left cursor-pointer"
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className="w-4 h-4 flex items-center justify-center text-blue-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                        </svg>
                                    </span>
                                    <span>Mã giảm giá đặc quyền của tôi</span>
                                </span>
                                <span className="text-slate-400">›</span>
                            </Link>
                            <Link
                                to="/booking-history"
                                className="w-full py-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl px-2 transition text-left cursor-pointer"
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className="w-4 h-4 flex items-center justify-center text-blue-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </span>
                                    <span>Lịch sử đặt phòng & Tra cứu</span>
                                </span>
                                <span className="text-slate-400">›</span>
                            </Link>
                        </div>
                    </div>

                    {/* CỘT BÊN PHẢI: FORM CHỈNH SỬA THÔNG TIN CÁ NHÂN (8 CỘT) */}
                    <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100">
                        <div className="border-b border-slate-100 pb-5 mb-6">
                            <div className="flex items-center gap-2.5 mb-1">
                                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                                    Thông Tin Cá Nhân
                                </h2>
                                {isEditing ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                        <span>✏️</span>
                                        <span>Đang chỉnh sửa</span>
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                        <span>👁️</span>
                                        <span>Chế độ xem</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">
                                Cập nhật thông tin chính xác giúp quá trình nhận phòng và nhận đặc quyền diễn ra nhanh chóng
                            </p>
                        </div>

                        {/* Alerts */}
                        {successMessage && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-2xl flex items-center gap-3 animate-fadeIn">
                                <span className="text-lg">✅</span>
                                <span className="font-medium flex-1">{successMessage}</span>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-2xl flex items-center gap-3 animate-fadeIn">
                                <span className="text-lg">⚠️</span>
                                <span className="font-medium flex-1">{errorMessage}</span>
                            </div>
                        )}

                        {/* Form Cập Nhật */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {/* Họ và tên */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Họ và tên đầy đủ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        disabled={!isEditing}
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Ví dụ: Nguyễn Văn An"
                                        className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm transition ${
                                            !isEditing
                                                ? 'bg-slate-100/80 border border-slate-200 text-slate-700 cursor-not-allowed select-text'
                                                : 'bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white'
                                        }`}
                                    />
                                </div>

                                {/* Số điện thoại */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Số điện thoại di động <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        disabled={!isEditing}
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                        placeholder="Ví dụ: 0912345678"
                                        className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm transition ${
                                            !isEditing
                                                ? 'bg-slate-100/80 border border-slate-200 text-slate-700 cursor-not-allowed select-text'
                                                : 'bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white'
                                        }`}
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Địa chỉ Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        disabled={!isEditing}
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@example.com"
                                        className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm transition ${
                                            !isEditing
                                                ? 'bg-slate-100/80 border border-slate-200 text-slate-700 cursor-not-allowed select-text'
                                                : 'bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white'
                                        }`}
                                    />
                                </div>

                                {/* Số CCCD / Passport */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Số CCCD / Hộ chiếu (Passport)
                                    </label>
                                    <input
                                        type="text"
                                        disabled={!isEditing}
                                        value={formData.idCardNumber}
                                        onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value })}
                                        placeholder={isEditing ? "Nhập số CCCD/Passport để check-in nhanh" : "Chưa cập nhật số CCCD/Passport"}
                                        className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm transition ${
                                            !isEditing
                                                ? 'bg-slate-100/80 border border-slate-200 text-slate-700 cursor-not-allowed select-text'
                                                : 'bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* Địa chỉ liên hệ */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Địa chỉ thường trú / Thành phố
                                </label>
                                <input
                                    type="text"
                                    disabled={!isEditing}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder={isEditing ? "Ví dụ: Quận 1, TP. Hồ Chí Minh" : "Chưa cập nhật địa chỉ"}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm transition ${
                                        !isEditing
                                            ? 'bg-slate-100/80 border border-slate-200 text-slate-700 cursor-not-allowed select-text'
                                            : 'bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white'
                                    }`}
                                />
                            </div>

                            {/* Sở thích lưu trú */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Sở thích & Yêu cầu lưu trú đặc biệt
                                </label>
                                <textarea
                                    rows={3}
                                    disabled={!isEditing}
                                    value={formData.preferences}
                                    onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
                                    placeholder={isEditing ? "Ví dụ: Thích phòng tầng cao, gối lông vũ mềm, không hút thuốc, đồ ăn ít đường..." : "Chưa có ghi chú sở thích đặc biệt"}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm transition ${
                                        !isEditing
                                            ? 'bg-slate-100/80 border border-slate-200 text-slate-700 cursor-not-allowed select-text'
                                            : 'bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white'
                                    }`}
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Đội ngũ quản gia khách sạn TA sẽ chuẩn bị phòng chu đáo nhất theo sở thích riêng của quý khách.
                                </span>
                            </div>

                            {/* Actions Button */}
                            <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                                <div className="text-xs text-slate-400">
                                    {isEditing ? (
                                        <>Các trường có dấu <span className="text-red-500">*</span> là bắt buộc.</>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-slate-500">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                            Hồ sơ đang ở chế độ xem. Nhấn nút <strong>Cập nhật</strong> để chỉnh sửa.
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {!isEditing ? (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(true)}
                                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition duration-200 flex items-center gap-2 cursor-pointer"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            <span>Cập nhật</span>
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                disabled={isLoading}
                                                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition duration-200 cursor-pointer disabled:opacity-60"
                                            >
                                                Hủy bỏ
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-70 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition duration-200 flex items-center gap-2 cursor-pointer"
                                            >
                                                {isLoading && (
                                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                )}
                                                <span>{isLoading ? 'Đang Lưu Thay Đổi...' : 'Lưu Thay Đổi Hồ Sơ'}</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <Footer />

            {/* Modal Đổi Mật Khẩu */}
            <ChangePasswordModal
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />
        </div>
    );
}
