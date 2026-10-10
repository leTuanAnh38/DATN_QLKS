import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, RefreshCw, X, Inbox, ChevronDown, Trash2 } from 'lucide-react';
import { useAuth } from '../../store/authStore';
import notificationService from '../../services/notificationService';

export default function NotificationBell({ theme = 'light' }) {
    const { isAuthenticated } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [allCount, setAllCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isClearingRead, setIsClearingRead] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all' | 'unread'
    const popoverRef = useRef(null);

    // Tải danh sách thông báo từ Backend API
    const fetchNotifications = async (isSilent = false, pageNum = 1, append = false, currentFilter = filter) => {
        if (!isAuthenticated) return;
        try {
            if (!isSilent && !append) setIsLoading(true);
            const params = {
                page: pageNum,
                page_size: 15,
            };
            if (currentFilter === 'unread') {
                params.unread_only = true;
            }

            const res = await notificationService.getNotifications(params);
            if (res.success && Array.isArray(res.data)) {
                if (append) {
                    setNotifications((prev) => {
                        const existingIds = new Set(prev.map((n) => n.id));
                        const uniqueNew = res.data.filter((n) => !existingIds.has(n.id));
                        return [...prev, ...uniqueNew];
                    });
                } else {
                    setNotifications(res.data);
                }

                setUnreadCount(
                    res.unread_count !== undefined
                        ? res.unread_count
                        : res.data.filter((n) => !n.is_read).length
                );
                setTotalCount(res.total_count !== undefined ? res.total_count : res.data.length);
                setAllCount(res.all_count !== undefined ? res.all_count : res.total_count || res.data.length);
                setHasNext(Boolean(res.has_next));
                setPage(pageNum);
            }
        } catch (error) {
            console.error('Lỗi khi tải thông báo:', error);
        } finally {
            if (!isSilent && !append) setIsLoading(false);
        }
    };

    // Hàm định dạng ngày giờ hiển thị theo đúng múi giờ địa phương của trình duyệt (Việt Nam UTC+7)
    const formatNotifTime = (notif) => {
        if (notif?.created_at) {
            try {
                const date = new Date(notif.created_at);
                if (!isNaN(date.getTime())) {
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${hours}:${minutes} • ${day}/${month}/${year}`;
                }
            } catch (e) { }
        }
        return notif?.created_at_display || 'Vừa xong';
    };

    // Logic Cập nhật (Polling): Tự động gọi API mỗi 30 giây / 1 lần & Lắng nghe sự kiện đồng bộ
    useEffect(() => {
        if (!isAuthenticated) return;

        // Fetch ngay khi mount
        fetchNotifications(false, 1, false, filter);

        // Đặt interval 30 giây: chỉ làm mới trang 1 ở chế độ silent
        const intervalId = setInterval(() => {
            fetchNotifications(true, 1, false, filter);
        }, 30000);

        // Lắng nghe sự kiện realtime khi có đơn duyệt hoặc Check-in thành công
        const handleSyncEvent = () => {
            fetchNotifications(true, 1, false, filter);
        };
        window.addEventListener('pms_booking_created', handleSyncEvent);
        const handleStorage = (e) => {
            if (e.key === 'pms_last_booking_event') {
                fetchNotifications(true, 1, false, filter);
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('pms_booking_created', handleSyncEvent);
            window.removeEventListener('storage', handleStorage);
        };
    }, [isAuthenticated, filter]);

    // Xử lý đóng popover khi click ra ngoài màn hình
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Khi bật mở popover
    const handleToggleOpen = () => {
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);
        if (nextOpen) {
            fetchNotifications(false, 1, false, filter);
        }
    };

    // Chuyển đổi bộ lọc tab
    const handleFilterChange = (newFilter) => {
        if (newFilter === filter) return;
        setFilter(newFilter);
        setNotifications([]);
        fetchNotifications(false, 1, false, newFilter);
    };

    // Tải thêm thông báo (Load more)
    const handleLoadMore = async () => {
        if (isLoadingMore || !hasNext) return;
        setIsLoadingMore(true);
        try {
            await fetchNotifications(false, page + 1, true, filter);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Đánh dấu 1 thông báo đã đọc khi click
    const handleNotificationClick = async (notif) => {
        if (!notif.is_read) {
            // Optimistic update: cập nhật state giao diện ngay lập tức
            setNotifications((prev) =>
                prev.map((item) => (item.id === notif.id ? { ...item, is_read: true } : item))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));

            // Gọi API lưu trạng thái backend
            await notificationService.markAsRead(notif.id);
        }
    };

    // Đánh dấu tất cả thông báo đã đọc
    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;

        // Optimistic update
        setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
        setUnreadCount(0);

        // Gọi API backend
        await notificationService.markAllAsRead();
    };

    // Dọn dẹp tất cả thông báo đã xem
    const handleClearRead = async () => {
        if (isClearingRead) return;
        setIsClearingRead(true);
        try {
            await notificationService.clearRead();
            await fetchNotifications(false, 1, false, filter);
        } catch (error) {
            console.error('Lỗi khi dọn dẹp thông báo:', error);
        } finally {
            setIsClearingRead(false);
        }
    };

    const hasReadNotifications = allCount > unreadCount || notifications.some((n) => n.is_read);

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="relative inline-block text-left" ref={popoverRef}>
            {/* Nút Chuông Icon */}
            <button
                type="button"
                onClick={handleToggleOpen}
                className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    theme === 'dark'
                        ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-blue-600 border border-slate-200 shadow-xs'
                }`}
                title="Thông báo hệ thống"
                aria-label="Thông báo hệ thống"
            >
                <Bell className="w-5 h-5 transition-transform duration-200 group-hover:rotate-12" />

                {/* Badge số lượng thông báo chưa đọc (unreadCount) */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu / Popover hiển thị danh sách */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-0 z-50 overflow-hidden animate-fadeIn"
                    style={{ transformOrigin: 'top right' }}
                >
                    {/* Header Popover */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-50 to-sky-50 text-slate-900 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-wide">Thông Báo</span>
                            {unreadCount > 0 && (
                                <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {unreadCount} mới
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllAsRead}
                                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer font-medium"
                                    title="Đánh dấu tất cả đã đọc"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>Đã đọc hết</span>
                                </button>
                            )}
                            {hasReadNotifications && (
                                <button
                                    type="button"
                                    onClick={handleClearRead}
                                    disabled={isClearingRead}
                                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600 transition cursor-pointer disabled:opacity-50"
                                    title="Dọn dẹp các thông báo đã đọc"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    <span>{isClearingRead ? 'Đang dọn...' : 'Dọn đã xem'}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => fetchNotifications(false, 1, false, filter)}
                                className="p-1 hover:bg-white rounded-lg text-slate-500 hover:text-slate-800 transition"
                                title="Tải lại thông báo"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center border-b border-slate-100 bg-slate-50/60 px-3 pt-2 text-xs">
                        <button
                            type="button"
                            onClick={() => handleFilterChange('all')}
                            className={`pb-2 px-3 font-semibold transition border-b-2 cursor-pointer ${
                                filter === 'all'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Tất cả ({allCount > 0 ? allCount : totalCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFilterChange('unread')}
                            className={`pb-2 px-3 font-semibold transition border-b-2 cursor-pointer ${
                                filter === 'unread'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Chưa đọc ({unreadCount})
                        </button>
                    </div>

                    {/* Danh sách thông báo */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 divide-opacity-60">
                        {isLoading && notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                                <span>Đang tải thông báo...</span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                                <Inbox className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                                <p className="font-medium text-slate-600">
                                    {filter === 'unread' ? 'Không có thông báo chưa đọc nào' : 'Bạn chưa có thông báo nào'}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    Hệ thống sẽ tự động cập nhật khi có đặt phòng hoặc dịch vụ mới.
                                </p>
                            </div>
                        ) : (
                            <>
                                {notifications.map((notif) => {
                                    const isUnread = !notif.is_read;
                                    return (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`p-3.5 transition-all duration-150 cursor-pointer relative ${
                                                isUnread
                                                    ? 'bg-blue-50/70 hover:bg-blue-100/60 border-l-3 border-blue-500'
                                                    : 'bg-white hover:bg-slate-50/90 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {isUnread && (
                                                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                                                        )}
                                                        {notif.title?.includes('Check-in') ? (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                                                                Check-in
                                                            </span>
                                                        ) : notif.title?.includes('Check-out') ? (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                                                                Check-out
                                                            </span>
                                                        ) : notif.title?.includes('Dịch vụ') ? (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                                                                Dịch vụ
                                                            </span>
                                                        ) : notif.title?.includes('gia hạn') || notif.title?.includes('Gia hạn') ? (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                                                                Gia hạn
                                                            </span>
                                                        ) : null}
                                                        <h4
                                                            className={`text-xs truncate ${
                                                                isUnread
                                                                    ? 'font-bold text-slate-900'
                                                                    : 'font-medium text-slate-700'
                                                            }`}
                                                        >
                                                            {notif.title}
                                                        </h4>
                                                    </div>
                                                    <p
                                                        className={`text-[11px] mt-1 line-clamp-3 leading-relaxed ${
                                                            isUnread ? 'text-slate-800' : 'text-slate-500'
                                                        }`}
                                                    >
                                                        {notif.message}
                                                    </p>
                                                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                                                        <span>{formatNotifTime(notif)}</span>
                                                        {isUnread ? (
                                                            <span className="text-blue-600 font-semibold text-[10px]">
                                                                Nhấn để đọc
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[10px]">Đã xem</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Nút Xem thêm khi còn trang sau */}
                                {hasNext && (
                                    <div className="p-3 text-center bg-slate-50/70 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                            className="w-full py-2 px-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-semibold text-blue-600 hover:text-blue-700 transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                                    <span>Đang tải thêm...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                                    <span>
                                                        Xem thêm thông báo {totalCount > notifications.length ? `(còn ${totalCount - notifications.length})` : ''}
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Đã tải hết */}
                                {!hasNext && notifications.length > 0 && (
                                    <div className="py-2.5 text-center text-[10px] text-slate-400 bg-slate-50/40">
                                        ✓ Đã hiển thị toàn bộ ({notifications.length}) thông báo
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer Popover: Tình trạng kết nối & Polling */}
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Tự động đồng bộ mỗi 30s
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded hover:bg-slate-200/60 transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
