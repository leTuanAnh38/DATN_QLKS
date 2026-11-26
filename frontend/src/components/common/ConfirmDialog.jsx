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
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 max-h-[90dvh] overflow-y-auto transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${bgMap[type] || bgMap.danger}`}>
                            {iconMap[type] || iconMap.danger}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900">{title}</h3>
                            {message && (
                                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">{message}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={onClose}
                            className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Đóng"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 border-t border-slate-100">
                    <button
                        type="button"
                        disabled={isLoading}
                        onClick={onClose}
                        className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white sm:bg-transparent border border-slate-200 sm:border-transparent hover:bg-slate-200/80 rounded-xl transition cursor-pointer flex items-center justify-center"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        disabled={isLoading || confirmDisabled}
                        onClick={onConfirm}
                        className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2.5 text-sm font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${btnMap[type] || btnMap.danger}`}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

