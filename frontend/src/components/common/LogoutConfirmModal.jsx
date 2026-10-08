import React, { useEffect } from 'react';

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200">
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
                className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 text-slate-800 transition-all transform scale-100 animate-in fade-in zoom-in-95 duration-150 z-10"
            >
                {/* Nút đóng góc phải */}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    title="Đóng"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Icon & Tiêu đề */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 shadow-xs">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth="2" 
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                            />
                        </svg>
                    </div>

                    <div className="flex-1 pr-4">
                        <h3 className="text-lg font-bold text-slate-900 leading-snug">
                            {title}
                        </h3>
                        {userName && (
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Tài khoản: <span className="text-slate-800">{userName}</span>
                                {role && <span className="text-blue-600 ml-1">({role})</span>}
                            </p>
                        )}
                    </div>
                </div>

                {/* Nội dung thông báo */}
                <div className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    {message || (
                        <span>
                            Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không? Phiên làm việc hiện tại của bạn sẽ kết thúc.
                        </span>
                    )}
                </div>

                {/* Nút thao tác */}
                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
                    >
                        Hủy bỏ
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Đang đăng xuất...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Đăng xuất</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
