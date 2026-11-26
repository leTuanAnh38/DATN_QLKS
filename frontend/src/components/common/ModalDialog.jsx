import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * ModalDialog - Khung modal chuẩn với backdrop, escape key, tiêu đề và nút đóng
 */
export default function ModalDialog({
    isOpen,
    onClose,
    title,
    subtitle,
    icon: Icon,
    children,
    maxWidth = 'max-w-2xl',
    className = '',
    headerActions,
    closeOnBackdrop = true,
}) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
            onClick={closeOnBackdrop ? onClose : undefined}
        >
            <div
                className={`bg-white rounded-2xl w-full ${maxWidth} max-h-[90dvh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden transform transition-all ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {(title || onClose) && (
                    <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0 z-10">
                        <div className="flex items-center gap-3 min-w-0">
                            {Icon && (
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Icon className="w-5 h-5" />
                                </div>
                            )}
                            <div className="min-w-0">
                                {title && <h3 className="text-base sm:text-lg font-bold text-slate-900 line-clamp-2 sm:truncate">{title}</h3>}
                                {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {headerActions}
                            {onClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="min-w-[40px] min-h-[40px] sm:min-w-[32px] sm:min-h-[32px] p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer flex items-center justify-center"
                                    aria-label="Đóng"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}

