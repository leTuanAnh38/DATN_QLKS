import React, { useEffect } from 'react';
import {
    LogOut,
    X,
    Loader2
} from 'lucide-react';

/**
 * Modal Xác Nhận Đăng Xuất dùng chung cho cả Khách hàng và Quản trị viên
 */
export default function LogoutConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
    title = 'Xác Nhận Đăng Xuất',
    message,
    userName,
    role
}) {
    // Đóng modal khi nhấn phím ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && !isLoading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLoading, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in">
            {/* Backdrop click */}
            <div 
                className="absolute inset-0" 
                onClick={!isLoading ? onClose : undefined} 
                aria-hidden="true"
            />

            {/* Modal Box */}
            <div 
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 text-slate-800 transition-all transform scale-100 animate-in zoom-in-95 duration-150 z-10 text-left"
            >
                {/* Nút đóng góc phải */}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    title="Đóng (Esc)"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon & Tiêu đề */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
                        <LogOut className="w-6 h-6 text-rose-600" />
                    </div>

                    <div className="flex-1 pr-4">
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                            {title}
                        </h3>
                        {userName && (
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Tài khoản: <span className="text-slate-800 font-bold">{userName}</span>
                                {role && <span className="text-blue-600 ml-1">({role})</span>}
                            </p>
                        )}
                    </div>
                </div>

                {/* Nội dung thông báo */}
                <div className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    {message || (
                        <span>
                            Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không? Phiên làm việc hiện tại của bạn sẽ kết thúc.
                        </span>
                    )}
                </div>

                {/* Nút thao tác */}
                <div className="mt-6 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
                    >
                        Hủy bỏ
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Đang đăng xuất...</span>
                            </>
                        ) : (
                            <>
                                <LogOut className="w-4 h-4" />
                                <span>Đăng xuất</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

