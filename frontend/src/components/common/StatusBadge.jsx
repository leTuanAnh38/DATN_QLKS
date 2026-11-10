import React from 'react';
import { ROOM_STATUSES, BOOKING_STATUSES, SERVICE_REQUEST_STATUSES } from '../../utils/constants';

/**
 * StatusBadge - Component hiển thị badge trạng thái chuẩn hóa
 * @param {'room' | 'booking' | 'service'} type Loại trạng thái
 * @param {string} status Mã trạng thái
 * @param {string} label Nhãn hiển thị tùy chọn (nếu muốn ghi đè)
 * @param {string} className Class Tailwind bổ sung
 * @param {boolean} showDot Hiển thị chấm tròn màu (mặc định true)
 */
export default function StatusBadge({
    type = 'booking',
    status,
    label,
    className = '',
    showDot = true,
}) {
    let config = null;

    if (type === 'room') {
        config = ROOM_STATUSES[status];
    } else if (type === 'booking') {
        config = BOOKING_STATUSES[status];
    } else if (type === 'service') {
        config = SERVICE_REQUEST_STATUSES[status];
    }

    const badgeLabel = label || config?.label || config?.shortLabel || status || '—';
    const colorClass = config?.badgeClass || config?.color || 'bg-slate-100 text-slate-700 border-slate-200';
    const dotColor = config?.indicatorColor;

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border transition-colors ${colorClass} ${className}`}
        >
            {showDot && dotColor && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            )}
            <span>{badgeLabel}</span>
        </span>
    );
}

