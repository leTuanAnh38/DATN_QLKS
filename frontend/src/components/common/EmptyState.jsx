import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * EmptyState - Giao diện hiển thị khi không có dữ liệu
 */
export default function EmptyState({
    icon: Icon = Inbox,
    title = 'Không có dữ liệu',
    description = 'Hiện tại chưa có dữ liệu nào để hiển thị trong mục này.',
    action,
    className = '',
}) {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                <Icon className="w-8 h-8" />
            </div>
            <h4 className="text-base font-semibold text-slate-800">{title}</h4>
            {description && (
                <p className="mt-1 text-sm text-slate-500 max-w-sm leading-relaxed">{description}</p>
            )}
            {action && (
                <div className="mt-5">{action}</div>
            )}
        </div>
    );
}

