import React, { useEffect } from 'react';
import {
    X,
    Crown,
    KeyRound,
    User,
    Phone,
    Mail,
    Award
} from 'lucide-react';
import { useAuth } from '../../store/authStore';
import UserAvatar from '../common/UserAvatar';
import { getRoleTitle } from '../../utils/permission';

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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh] animate-in zoom-in-95 duration-200 text-left"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Nút đóng cố định góc phải */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-black/25 hover:bg-black/45 text-white flex items-center justify-center transition cursor-pointer backdrop-blur-xs"
                    title="Đóng (Esc)"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* 1 & 2. Cover + Body Details (Scrollable cùng nhau để Avatar không bị cắt trên mobile) */}
                <div className="flex-1 min-h-0 overflow-y-auto relative">
                    <div className="h-24 sm:h-28 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500" />

                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-12 mb-4 gap-2.5 sm:gap-3">
                            <UserAvatar
                                avatar={user.avatar}
                                name={user.full_name || user.username}
                                role={user.role}
                                size="2xl"
                                border={true}
                            />
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                                    <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>{getRoleTitle(user.role, user.guest_profile?.vip_tier)}</span>
                                </span>
                            </div>
                        </div>

                        <div className="mb-5 sm:mb-6 text-center sm:text-left">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight break-words">
                                {user.full_name || user.username}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 break-words">
                                {user.email || 'Chưa cập nhật email'} • {user.phone_number || 'Chưa có SĐT'}
                            </p>
                        </div>

                        {/* Profile Fields List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <User className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Họ và tên</span>
                                </div>
                                <span className="font-semibold text-slate-800 text-sm block break-words">
                                    {user.full_name || 'Khách lưu trú'}
                                </span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <Phone className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Số điện thoại</span>
                                </div>
                                <span className="font-semibold text-slate-800 text-sm block">
                                    {user.phone_number || 'Chưa cập nhật'}
                                </span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Email tài khoản</span>
                                </div>
                                <span className="font-semibold text-slate-800 text-sm truncate block" title={user.email}>
                                    {user.email || 'Chưa cập nhật'}
                                </span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                                    <Award className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Điểm thưởng TA Club</span>
                                </div>
                                <span className="font-semibold text-amber-600 text-sm block">
                                    {user.guest_profile?.loyalty_points || 0} điểm
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Footer Actions (Sticky Bottom) */}
                <div className="shrink-0 px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-4 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            if (onOpenChangePassword) onOpenChangePassword();
                        }}
                        className="min-h-[44px] sm:min-h-0 py-2 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                        <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Đổi mật khẩu</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[44px] sm:min-h-0 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

