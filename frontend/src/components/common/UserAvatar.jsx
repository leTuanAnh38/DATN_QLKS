import React, { useState, useEffect } from 'react';

/**
 * Helper chuyển đường dẫn avatar tương đối thành URL đầy đủ
 */
export const getFullAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
        return avatar;
    }
    const backendBase = 'http://localhost:8000';
    return `${backendBase}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
};

/**
 * Helper trích xuất 2 ký tự viết tắt của Họ Tên
 */
export const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'TA';
    const trimmed = name.trim();
    if (!trimmed) return 'TA';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Bảng màu gradient sang trọng phân theo vai trò tài khoản
 * Cung cấp cả class Tailwind và inline CSS style đảm bảo hiển thị sắc nét 100%,
 * không bị phụ thuộc vào phiên bản Tailwind hay lỗi nền trong suốt.
 */
const ROLE_THEMES = {
    admin: {
        gradient: 'bg-linear-to-tr from-purple-700 via-indigo-600 to-blue-700 text-white',
        style: {
            background: 'linear-gradient(135deg, #6b21a8 0%, #4f46e5 50%, #1d4ed8 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-purple-400/60',
        borderStyle: { borderColor: 'rgba(192, 132, 252, 0.6)' },
        shadow: 'shadow-purple-700/20',
    },
    owner: {
        gradient: 'bg-linear-to-tr from-amber-700 via-amber-600 to-yellow-500 text-white',
        style: {
            background: 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #eab308 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-amber-400/60',
        borderStyle: { borderColor: 'rgba(251, 191, 36, 0.6)' },
        shadow: 'shadow-amber-700/20',
    },
    manager: {
        gradient: 'bg-linear-to-tr from-blue-700 via-indigo-600 to-blue-500 text-white',
        style: {
            background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 50%, #3b82f6 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-blue-400/60',
        borderStyle: { borderColor: 'rgba(147, 197, 253, 0.6)' },
        shadow: 'shadow-blue-700/20',
    },
    receptionist: {
        gradient: 'bg-linear-to-tr from-emerald-700 via-teal-600 to-emerald-500 text-white',
        style: {
            background: 'linear-gradient(135deg, #047857 0%, #0d9488 50%, #10b981 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-emerald-400/60',
        borderStyle: { borderColor: 'rgba(110, 231, 183, 0.6)' },
        shadow: 'shadow-emerald-700/20',
    },
    cashier: {
        gradient: 'bg-linear-to-tr from-cyan-700 via-teal-600 to-cyan-500 text-white',
        style: {
            background: 'linear-gradient(135deg, #0e7490 0%, #0d9488 50%, #06b6d4 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-cyan-400/60',
        borderStyle: { borderColor: 'rgba(103, 232, 249, 0.6)' },
        shadow: 'shadow-cyan-700/20',
    },
    housekeeper: {
        gradient: 'bg-linear-to-tr from-orange-600 via-amber-500 to-amber-700 text-white',
        style: {
            background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 50%, #b45309 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-orange-400/60',
        borderStyle: { borderColor: 'rgba(253, 186, 116, 0.6)' },
        shadow: 'shadow-orange-700/20',
    },
    service_staff: {
        gradient: 'bg-linear-to-tr from-rose-600 via-pink-600 to-amber-600 text-white',
        style: {
            background: 'linear-gradient(135deg, #e11d48 0%, #db2777 50%, #d97706 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-rose-400/60',
        borderStyle: { borderColor: 'rgba(253, 164, 175, 0.6)' },
        shadow: 'shadow-rose-700/20',
    },
    technician: {
        gradient: 'bg-linear-to-tr from-indigo-700 via-blue-600 to-sky-600 text-white',
        style: {
            background: 'linear-gradient(135deg, #4338ca 0%, #2563eb 50%, #0284c7 100%)',
            color: '#ffffff',
        },
        borderColor: 'border-indigo-400/60',
        borderStyle: { borderColor: 'rgba(165, 180, 252, 0.6)' },
        shadow: 'shadow-indigo-700/20',
    },
    guest: {
        gradient: 'bg-linear-to-tr from-slate-800 via-slate-700 to-blue-950 text-amber-300',
        style: {
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #172554 100%)',
            color: '#fcd34d',
        },
        borderColor: 'border-amber-400/50',
        borderStyle: { borderColor: 'rgba(251, 191, 36, 0.6)' },
        shadow: 'shadow-slate-900/30',
    },
};

/**
 * Component UserAvatar mặc định sang trọng chuẩn 5 sao
 * - Hỗ trợ tự động fallback khi avatar null/rỗng hoặc load ảnh bị lỗi 404
 * - Phân màu gradient tinh tế theo vai trò (Admin, Quản lý, Nhân viên, Khách hàng)
 * - Tương thích chuẩn Tailwind v4 kết hợp inline fallback chắc chắn không bao giờ bị màu trắng tinh
 */
export default function UserAvatar({
    avatar = null,
    name = '',
    role = 'guest',
    size = 'md',
    className = '',
    border = true,
    showOnline = false,
}) {
    const [imageError, setImageError] = useState(false);

    // Reset trạng thái lỗi khi avatar thay đổi
    useEffect(() => {
        setImageError(false);
    }, [avatar]);

    const fullUrl = getFullAvatarUrl(avatar);
    const hasImage = Boolean(fullUrl && !imageError);
    const initials = getInitials(name);

    // Kích thước chuẩn
    const sizeClasses = {
        xs: 'w-6 h-6 text-[9px]',
        sm: 'w-8 h-8 text-[11px]',
        md: 'w-9 h-9 text-xs',
        lg: 'w-11 h-11 text-sm',
        xl: 'w-16 h-16 text-lg',
        '2xl': 'w-20 h-20 text-xl sm:text-2xl',
    };

    const currentSize = sizeClasses[size] || sizeClasses.md;
    const theme = ROLE_THEMES[role] || ROLE_THEMES.guest;

    return (
        <div className={`relative shrink-0 inline-flex items-center justify-center select-none ${className}`}>
            <div
                className={`${currentSize} rounded-full overflow-hidden flex items-center justify-center font-bold tracking-wider transition-transform duration-200 ${
                    border ? `border-2 ${theme.borderColor}` : ''
                } ${theme.shadow} shadow-sm`}
                style={{
                    ...(border ? theme.borderStyle : {}),
                    ...(hasImage ? {} : theme.style),
                }}
            >
                {hasImage ? (
                    <img
                        src={fullUrl}
                        alt={name || 'User Avatar'}
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover rounded-full"
                    />
                ) : (
                    <div
                        className={`w-full h-full flex items-center justify-center ${theme.gradient}`}
                        style={theme.style}
                    >
                        {/* Ký tự viết tắt họ tên sắc nét, tương phản chuẩn */}
                        <span className="font-extrabold uppercase drop-shadow-sm select-none">
                            {initials}
                        </span>
                    </div>
                )}
            </div>

            {/* Chấm tròn báo trạng thái Online nếu bật */}
            {showOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
            )}
        </div>
    );
}
