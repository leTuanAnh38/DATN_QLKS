import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, Loader2 } from 'lucide-react';

/**
 * ConfirmDialog - Hộp thoại xác nhận thao tác chuẩn hóa
 */
export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = 'Xác nhận thao tác',
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy bỏ',
    type = 'danger', // 'danger' | 'warning' | 'info' | 'success'
    isLoading = false,
    confirmDisabled = false,
}) {
    if (!isOpen) return null;

    const iconMap = {
        danger: <AlertTriangle className="w-6 h-6 text-rose-600" />,
        warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
        info: <Info className="w-6 h-6 text-blue-600" />,
        success: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
    };

    const bgMap = {
        danger: 'bg-rose-100',
        warning: 'bg-amber-100',
        info: 'bg-blue-100',
        success: 'bg-emerald-100',
    };

    const btnMap = {
        danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200',
        warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200',
        info: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
        success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200',
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgMap[type] || bgMap.danger}`}>
                            {iconMap[type] || iconMap.danger}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                            {message && (
                                <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{message}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                        type="button"
                        disabled={isLoading}
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        disabled={isLoading || confirmDisabled}
                        onClick={onConfirm}
                        className={`px-5 py-2.5 text-sm font-semibold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${btnMap[type] || btnMap.danger}`}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

