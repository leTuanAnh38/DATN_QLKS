import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * LoadingSpinner - Spinner tải trang / dữ liệu chuẩn hóa
 */
export default function LoadingSpinner({
    size = 'md', // 'sm' | 'md' | 'lg'
    text = 'Đang tải dữ liệu...',
    fullScreen = false,
    className = '',
}) {
    const sizeMap = {
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    const content = (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <Loader2 className={`${sizeMap[size] || sizeMap.md} text-blue-600 animate-spin`} />
            {text && <span className="text-sm font-medium text-slate-500">{text}</span>}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                {content}
            </div>
        );
    }

    return (
        <div className="py-12 flex items-center justify-center">
            {content}
        </div>
    );
}

