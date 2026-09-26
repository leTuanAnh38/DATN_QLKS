import React, { useEffect } from 'react';
import { useAuth } from '../../store/authStore';

export default function ProfileModal({ isOpen, onClose, onOpenChangePassword }) {
    const { user } = useAuth();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !user) return null;

    const getInitials = (name) => {
        if (!name) return 'TA';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Profile Cover */}
                <div className="h-28 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 relative p-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Avatar & Header details */}
                <div className="px-6 pb-6 pt-0 relative">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-12 mb-4 gap-3">
                        <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
                            {user.avatar ? (
                                <img
                                    src={user.avatar}
                                    alt={user.full_name}
                                    className="w-full h-full object-cover rounded-full"
                                />
                            ) : (
                                getInitials(user.full_name || user.username)
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                👑 {user.role === 'admin' ? 'Admin Quản Trị' : `Hội viên ${user.guest_profile?.vip_tier || 'Silver'}`}
                            </span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-serif text-xl font-bold text-slate-900">
                            {user.full_name || user.username}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {user.email || 'Chưa cập nhật email'} • {user.phone_number || 'Chưa có SĐT'}
                        </p>
                    </div>

                    {/* Profile Fields List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-6">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Họ và tên</span>
                            <span className="font-semibold text-slate-800 text-sm">
                                {user.full_name || 'Khách lưu trú'}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Số điện thoại</span>
                            <span className="font-semibold text-slate-800 text-sm">
                                {user.phone_number || 'Chưa cập nhật'}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Email tài khoản</span>
                            <span className="font-semibold text-slate-800 text-sm truncate block">
                                {user.email || 'Chưa cập nhật'}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Điểm thưởng TA Club</span>
                            <span className="font-semibold text-amber-600 text-sm">
                                {user.guest_profile?.loyalty_points || 0} điểm
                            </span>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                if (onOpenChangePassword) onOpenChangePassword();
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                        >
                            <span>🔑</span> Đổi mật khẩu
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
