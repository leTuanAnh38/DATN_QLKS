import React, { useState, useEffect, useRef } from 'react';
import {
    Camera,
    Save,
    Loader2,
    Mail,
    Phone,
    User,
    Shield,
    Building2,
    Briefcase,
    Calendar,
    Clock,
    Lock,
    CheckCircle2,
    AlertCircle,
    RotateCcw
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../store/authStore';
import { getFullAvatarUrl, getInitials } from '../../components/common/UserAvatar';

export default function StaffProfile() {
    const { user: currentAuthUser, updateUser } = useAuth();
    const fileInputRef = useRef(null);

    // Form fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [employeeCode, setEmployeeCode] = useState('');
    const [department, setDepartment] = useState('');
    const [role, setRole] = useState('');
    const [roleDisplay, setRoleDisplay] = useState('');
    const [position, setPosition] = useState('');
    const [shift, setShift] = useState('');
    const [hireDate, setHireDate] = useState('');

    // Avatar state
    const [previewAvatar, setPreviewAvatar] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [initialAvatarUrl, setInitialAvatarUrl] = useState(null);

    // Request status
    const [isFetching, setIsFetching] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState({ type: null, message: '' });

    // Tải dữ liệu hồ sơ cá nhân hiện tại từ GET /api/users/me/
    const fetchProfile = async () => {
        try {
            setIsFetching(true);
            const res = await api.get('/users/me/');
            if (res.data?.success && res.data.user) {
                const u = res.data.user;
                setFirstName(u.first_name || '');
                setLastName(u.last_name || '');
                setPhoneNumber(u.phone_number || '');
                setEmail(u.email || '');
                setRole(u.role || '');
                setRoleDisplay(u.role_display || (u.role ? u.role.toUpperCase() : 'NHÂN VIÊN'));
                setDepartment(u.department || u.employee_profile?.department || 'Ban Quản trị Khách sạn');
                setEmployeeCode(u.employee_code || u.employee_profile?.employee_code || `NV${String(u.id).padStart(4, '0')}`);
                setPosition(u.position || u.employee_profile?.position || 'Nhân sự');
                setShift(u.shift || u.employee_profile?.shift || 'Ca hành chính');
                setHireDate(u.hire_date || u.employee_profile?.hire_date || '');

                const resolvedAvatar = getFullAvatarUrl(u.avatar);
                setPreviewAvatar(resolvedAvatar);
                setInitialAvatarUrl(resolvedAvatar);
            }
        } catch (err) {
            console.error('Lỗi khi tải hồ sơ cá nhân:', err);
            setFeedback({
                type: 'error',
                message: 'Không thể kết nối đến máy chủ để lấy thông tin hồ sơ.'
            });
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    // Xử lý khi người dùng chọn file ảnh mới
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Kiểm tra loại file
        if (!file.type.startsWith('image/')) {
            setFeedback({
                type: 'error',
                message: 'Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP, GIF).'
            });
            return;
        }

        // Giới hạn dung lượng 5MB
        if (file.size > 5 * 1024 * 1024) {
            setFeedback({
                type: 'error',
                message: 'Dung lượng ảnh đại diện không được vượt quá 5MB.'
            });
            return;
        }

        // Xem trước ảnh tức thì bằng Object URL
        setSelectedFile(file);
        const objectUrl = URL.createObjectURL(file);
        setPreviewAvatar(objectUrl);
        setFeedback({
            type: 'info',
            message: 'Đã tải ảnh xem trước. Hãy nhấn "Lưu thay đổi" để cập nhật vào hệ thống.'
        });
    };

    // Hủy chọn ảnh mới, quay về ảnh cũ
    const handleCancelAvatar = () => {
        setSelectedFile(null);
        setPreviewAvatar(initialAvatarUrl);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setFeedback({ type: null, message: '' });
    };

    // Xử lý submit form: Gửi FormData qua PATCH /api/users/me/
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFeedback({ type: null, message: '' });

        if (!firstName.trim()) {
            setFeedback({ type: 'error', message: 'Họ và tên đệm không được để trống.' });
            return;
        }
        if (!lastName.trim()) {
            setFeedback({ type: 'error', message: 'Tên không được để trống.' });
            return;
        }

        try {
            setIsLoading(true);

            // Khởi tạo FormData chuẩn multipart/form-data
            const formData = new FormData();
            formData.append('first_name', firstName.trim());
            formData.append('last_name', lastName.trim());
            formData.append('full_name', `${firstName.trim()} ${lastName.trim()}`);
            if (phoneNumber.trim()) {
                formData.append('phone_number', phoneNumber.trim());
            }

            // Đính kèm file ảnh nếu có thay đổi
            if (selectedFile) {
                formData.append('avatar', selectedFile);
            }

            // Gọi API PATCH /api/users/me/
            const response = await api.patch('/users/me/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data?.success && response.data.user) {
                const updatedUser = response.data.user;
                // Đồng bộ cập nhật vào auth store để Topbar & Sidebar đổi ảnh/tên ngay lập tức
                updateUser(updatedUser);

                const newAvatarUrl = getFullAvatarUrl(updatedUser.avatar);
                setPreviewAvatar(newAvatarUrl);
                setInitialAvatarUrl(newAvatarUrl);
                setSelectedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }

                setFeedback({
                    type: 'success',
                    message: response.data.message || 'Hồ sơ cá nhân và ảnh đại diện đã được cập nhật thành công!'
                });
            } else {
                setFeedback({
                    type: 'error',
                    message: response.data?.message || 'Không thể lưu thay đổi.'
                });
            }
        } catch (error) {
            console.error('Lỗi khi cập nhật hồ sơ:', error);
            const errRes = error.response?.data;
            const errorMsg =
                errRes?.message ||
                errRes?.detail ||
                errRes?.phone_number?.[0] ||
                errRes?.avatar?.[0] ||
                'Đã xảy ra lỗi trong quá trình lưu hồ sơ. Vui lòng kiểm tra lại.';
            setFeedback({
                type: 'error',
                message: errorMsg
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Helper tạo huy hiệu Badge Chức vụ
    const renderRoleBadge = () => {
        const r = role.toLowerCase();
        let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
        let label = roleDisplay || 'NHÂN VIÊN';

        if (r === 'admin' || r === 'owner') {
            badgeStyle = 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs shadow-amber-500/10';
        } else if (r === 'manager') {
            badgeStyle = 'bg-purple-50 text-purple-700 border-purple-300 shadow-xs shadow-purple-500/10';
        } else if (r === 'receptionist') {
            badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs shadow-emerald-500/10';
        } else if (r === 'cashier') {
            badgeStyle = 'bg-cyan-50 text-cyan-700 border-cyan-300';
        }

        return (
            <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${badgeStyle}`}>
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
            </div>
        );
    };

    const fullNameDisplay = `${firstName} ${lastName}`.trim() || currentAuthUser?.username || 'Hồ Sơ Nhân Sự';
    const initials = getInitials(fullNameDisplay);

    if (isFetching) {
        return (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-12 flex flex-col items-center justify-center min-h-[420px]">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-600 font-medium text-sm">Đang tải thông tin hồ sơ nhân viên...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header Tiêu đề Trang */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <User className="w-6 h-6 text-blue-600" />
                        Hồ sơ Nhân viên & Ban Quản trị
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Xem và cập nhật thông tin cá nhân của bạn trong hệ thống quản lý Khách sạn TA.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Tài khoản đang hoạt động
                    </span>
                </div>
            </div>

            {/* Thông báo phản hồi (Alert Banner) */}
            {feedback.message && (
                <div
                    className={`p-4 rounded-xl border flex items-start gap-3 transition-all animate-fadeIn ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : feedback.type === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}
                >
                    {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
                    {feedback.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                    {feedback.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
                    <div className="flex-1 text-sm font-medium">{feedback.message}</div>
                    <button
                        type="button"
                        onClick={() => setFeedback({ type: null, message: '' })}
                        className="text-xs opacity-60 hover:opacity-100 transition cursor-pointer font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* GIAO DIỆN 2 CỘT (LAYOUT GRID) THEO YÊU CẦU */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* --------------------------------------------------------------------- */}
                {/* CỘT TRÁI (Khu vực Ảnh & Chức vụ - Cột nhỏ lg:col-span-4)              */}
                {/* --------------------------------------------------------------------- */}
                <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 flex flex-col items-center text-center sticky top-24">
                    {/* Input file ẩn, kết nối bằng useRef */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {/* Vùng ảnh đại diện Avatar tròn to */}
                    <div className="relative group cursor-pointer">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-40 h-40 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-white shadow-xl shadow-slate-200/80 ring-4 ring-slate-100 group-hover:ring-blue-400 transition-all duration-300 relative bg-slate-100"
                            title="Bấm để thay đổi ảnh đại diện"
                        >
                            {previewAvatar ? (
                                <img
                                    src={previewAvatar}
                                    alt={fullNameDisplay}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 text-white font-serif font-black text-4xl shadow-inner">
                                    {initials}
                                </div>
                            )}

                            {/* Lớp phủ mờ (Overlay) & Icon Camera khi Hover */}
                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white gap-2">
                                <div className="p-2.5 rounded-full bg-white/20 backdrop-blur-md">
                                    <Camera className="w-6 h-6 text-white drop-shadow" />
                                </div>
                                <span className="text-xs font-semibold tracking-wide">Thay đổi ảnh</span>
                            </div>
                        </div>

                        {/* Nút bấm Camera ở góc dưới ảnh */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-2 right-2 p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition transform hover:scale-110 active:scale-95 cursor-pointer border-2 border-white"
                            title="Tải ảnh mới từ máy tính"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Nút hủy ảnh đã chọn (chỉ hiện khi có chọn ảnh mới mà chưa lưu) */}
                    {selectedFile && (
                        <div className="mt-4 flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                                Đã chọn ảnh mới
                            </span>
                            <button
                                type="button"
                                onClick={handleCancelAvatar}
                                className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 transition cursor-pointer"
                                title="Hủy ảnh vừa chọn"
                            >
                                <RotateCcw className="w-3 h-3" /> Hủy
                            </button>
                        </div>
                    )}

                    {/* Bên dưới ảnh: Hiển thị Tên đầy đủ in đậm */}
                    <h2 className="text-xl font-bold text-slate-900 mt-5 leading-tight">
                        {fullNameDisplay}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                        @{currentAuthUser?.username || 'user'}
                    </p>

                    {/* Badge màu sắc hiển thị Chức vụ (LỄ TÂN, QUẢN LÝ...) */}
                    <div className="mt-3.5">
                        {renderRoleBadge()}
                    </div>

                    {/* Thông tin vắn tắt (Mã NV & Phòng ban) */}
                    <div className="w-full mt-6 pt-6 border-t border-slate-100 space-y-3 text-xs text-left">
                        <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5" /> Mã nhân viên:
                            </span>
                            <span className="font-semibold text-slate-800 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                {employeeCode}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" /> Phòng ban:
                            </span>
                            <span className="font-semibold text-slate-800 truncate max-w-[180px]" title={department}>
                                {department}
                            </span>
                        </div>

                        {position && (
                            <div className="flex items-center justify-between text-slate-600">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5" /> Vị trí:
                                </span>
                                <span className="font-semibold text-slate-800">
                                    {position}
                                </span>
                            </div>
                        )}

                        {shift && (
                            <div className="flex items-center justify-between text-slate-600">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" /> Ca trực:
                                </span>
                                <span className="font-semibold text-slate-800">
                                    {shift}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* --------------------------------------------------------------------- */}
                {/* CỘT PHẢI (Form Thông tin cá nhân - Cột lớn lg:col-span-8)             */}
                {/* --------------------------------------------------------------------- */}
                <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="border-b border-slate-100 pb-4">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-600" />
                                Thông tin cá nhân
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Cập nhật thông tin liên hệ và họ tên để hiển thị trên chứng từ và lịch phân ca.
                            </p>
                        </div>

                        {/* Nhóm Input: Họ và Tên (Được phép sửa) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Họ và tên đệm <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                        <User className="w-4 h-4" />
                                    </span>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Ví dụ: Nguyễn Văn"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Tên gọi <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                        <User className="w-4 h-4" />
                                    </span>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Ví dụ: An"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Input: Số điện thoại (Được phép sửa) */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Số điện thoại di động
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                    <Phone className="w-4 h-4" />
                                </span>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="Ví dụ: 0912345678"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Dùng để nhận tin nhắn xác thực bảo mật và liên hệ nội bộ khách sạn.
                            </p>
                        </div>

                        {/* Phân cách khu vực Chỉ được xem (Read-only) */}
                        <div className="border-t border-slate-100 pt-5">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-slate-400" />
                                Thông tin quản trị & Phân quyền (Chỉ xem)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Các thông tin này do Bộ phận Nhân sự & Admin quản lý, nhân viên không thể tự ý sửa đổi.
                            </p>
                        </div>

                        {/* Input: Địa chỉ Email (Read-only / disabled) */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                                <span>Địa chỉ Email tài khoản</span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                                    <Lock className="w-3 h-3" /> Cố định
                                </span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                    <Mail className="w-4 h-4" />
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    readOnly
                                    disabled
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-gray-100 text-slate-500 text-sm cursor-not-allowed select-none"
                                />
                            </div>
                        </div>

                        {/* Grid 2 cột: Mã nhân viên & Phòng ban (Read-only / disabled) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                                    <span>Mã nhân viên (Staff ID)</span>
                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                                        <Lock className="w-3 h-3" /> Hệ thống cấp
                                    </span>
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                        <Briefcase className="w-4 h-4" />
                                    </span>
                                    <input
                                        type="text"
                                        value={employeeCode}
                                        readOnly
                                        disabled
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-gray-100 text-slate-500 font-mono text-sm cursor-not-allowed select-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                                    <span>Phòng ban trực thuộc</span>
                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                                        <Lock className="w-3 h-3" /> Bổ nhiệm
                                    </span>
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                        <Building2 className="w-4 h-4" />
                                    </span>
                                    <input
                                        type="text"
                                        value={department}
                                        readOnly
                                        disabled
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-gray-100 text-slate-500 text-sm cursor-not-allowed select-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Nút hành động Lưu thay đổi */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-xs text-slate-400 text-center sm:text-left">
                                Dữ liệu sẽ được lưu an toàn vào hệ thống máy chủ khách sạn.
                            </p>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-500/20 hover:shadow-lg transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Đang lưu thay đổi...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Lưu thay đổi</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
