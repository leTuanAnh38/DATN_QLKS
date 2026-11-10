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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
            onClick={closeOnBackdrop ? onClose : undefined}
        >
            <div
                className={`bg-white rounded-2xl w-full ${maxWidth} shadow-2xl border border-slate-100 overflow-hidden transform transition-all my-8 ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {(title || onClose) && (
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            {Icon && (
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Icon className="w-5 h-5" />
                                </div>
                            )}
                            <div>
                                {title && <h3 className="text-lg font-bold text-slate-900">{title}</h3>}
                                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {headerActions}
                            {onClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

