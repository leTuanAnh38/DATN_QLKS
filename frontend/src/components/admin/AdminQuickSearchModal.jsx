import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    X,
    CornerDownLeft,
    ArrowUp,
    ArrowDown,
    LayoutDashboard,
    BedDouble,
    CalendarDays,
    CalendarCheck,
    Users,
    Building2,
    ConciergeBell,
    Utensils,
    Receipt,
    BarChart3,
    Layers,
    Sparkles,
    Wine,
    PackageSearch,
    UserCog,
    Star,
    Newspaper,
    Tag,
    MessageSquare,
    ShieldCheck,
    Settings,
    Loader2,
    ArrowRight,
    Phone,
    Hash
} from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import roomService from '../../services/roomService';
import { adminUserService } from '../../services/adminUserService';

// Chuẩn hóa tiếng Việt không dấu để tìm kiếm nhanh nhạy
const normalizeText = (str) =>
    String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();

const formatDateShort = (dateStr) => {
    if (!dateStr) return '—';
    const parts = String(dateStr).split('T')[0].split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
};

const BOOKING_STATUS_BADGE = {
    pending: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    paid: { label: 'Chờ duyệt (QR)', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    PAID: { label: 'Chờ duyệt (QR)', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    confirmed: { label: 'Đã xác nhận', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    checked_in: { label: 'Đang lưu trú', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    checked_out: { label: 'Đã trả phòng', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    completed: { label: 'Hoàn tất', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    no_show: { label: 'No-show', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    cancelled: { label: 'Đã hủy', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
};

const ROOM_STATUS_BADGE = {
    available: { label: 'Sẵn sàng', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    occupied: { label: 'Đang có khách', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    cleaning: { label: 'Đang dọn', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    maintenance: { label: 'Bảo trì', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
};

export default function AdminQuickSearchModal({
    isOpen,
    onClose,
    permissions = {},
    onNavigateTab,
    onNavigateCustomer,
    onSelectBooking
}) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [bookingResults, setBookingResults] = useState([]);
    const [roomResults, setRoomResults] = useState([]);
    const [guestResults, setGuestResults] = useState([]);

    const inputRef = useRef(null);
    const cachedBookingsRef = useRef(null);
    const listContainerRef = useRef(null);

    // Danh sách lối tắt điều hướng phân hệ theo RBAC
    const navShortcuts = useMemo(() => {
        const all = [
            { id: 'nav-overview', tab: 'overview', label: 'Tổng quan hệ thống', sub: 'Dashboard vận hành & KPI', keywords: 'tong quan dashboard kpi doanh thu', icon: LayoutDashboard, allowed: permissions.overview },
            { id: 'nav-rooms', tab: 'rooms', label: 'Sơ đồ Phòng PMS', sub: 'Trạng thái phòng thực tế, dọn buồng', keywords: 'so do phong pms housekeeping buong phong', icon: BedDouble, allowed: permissions.rooms },
            { id: 'nav-timeline', tab: 'booking-timeline', label: 'Lịch Đặt phòng (Tape Chart)', sub: 'Sơ đồ Gantt đặt phòng theo ngày', keywords: 'lich dat phong timeline gantt tape chart', icon: CalendarDays, allowed: permissions.bookings },
            { id: 'nav-bookings', tab: 'bookings', label: 'Quản lý Đặt phòng & Lưu trú', sub: 'Check-in, check-out, khách lẻ & đoàn B2B', keywords: 'dat phong booking check in check out khach doan', icon: CalendarCheck, allowed: permissions.bookings },
            { id: 'nav-guests', tab: 'guests', label: 'Khách hàng & CRM', sub: 'Hồ sơ khách lưu trú, hạng thành viên VIP', keywords: 'khach hang crm guest vip thanh vien', icon: Users, allowed: permissions.guests },
            { id: 'nav-partners', tab: 'corporate-partners', label: 'Đối tác Doanh nghiệp (B2B)', sub: 'Công ty, đại lý lữ hành, công nợ đoàn', keywords: 'doi tac doanh nghiep b2b cong ty corporate', icon: Building2, allowed: permissions.corporatePartners },
            { id: 'nav-services', tab: 'services', label: 'Yêu cầu Dịch vụ (Kanban)', sub: 'Tiếp nhận & điều phối dịch vụ phòng', keywords: 'yeu cau dich vu kanban concierge phuc vu', icon: ConciergeBell, allowed: permissions.services },
            { id: 'nav-service-items', tab: 'service-items', label: 'Thực đơn & Danh mục Dịch vụ', sub: 'Quản lý món ăn, spa, giặt ủi, đưa đón', keywords: 'thuc don menu dich vu spa an uong', icon: Utensils, allowed: permissions.services },
            { id: 'nav-invoices', tab: 'invoices', label: 'Hóa đơn & Thu ngân', sub: 'Thanh toán, bàn giao ca trực, VietQR', keywords: 'hoa don thu ngan thanh toan ca truc invoice finance', icon: Receipt, allowed: permissions.invoices },
            { id: 'nav-analytics', tab: 'analytics', label: 'Báo cáo & Thống kê Doanh thu', sub: 'Biểu đồ công suất, doanh thu, nguồn đặt', keywords: 'bao cao thong ke doanh thu analytics report', icon: BarChart3, allowed: permissions.analytics },
            { id: 'nav-categories', tab: 'categories', label: 'Hạng phòng & Bảng giá', sub: 'Cấu hình loại phòng, giá niêm yết, ảnh', keywords: 'hang phong bang gia loai phong category', icon: Layers, allowed: permissions.categories },
            { id: 'nav-amenities', tab: 'amenities', label: 'Tiện nghi phòng', sub: 'Danh mục tiện ích & trang thiết bị', keywords: 'tien nghi phong amenity', icon: Sparkles, allowed: permissions.categories },
            { id: 'nav-minibar', tab: 'minibar', label: 'Danh mục Minibar', sub: 'Đồ uống, snack & bảng giá minibar', keywords: 'minibar do uong snack', icon: Wine, allowed: permissions.categories || permissions.rooms },
            { id: 'nav-lost', tab: 'lost-and-found', label: 'Quản lý Đồ thất lạc', sub: 'Ghi nhận & trao trả đồ khách bỏ quên', keywords: 'do that lac lost and found bo quen', icon: PackageSearch, allowed: permissions.rooms },
            { id: 'nav-employees', tab: 'employees', label: 'Nhân sự & Phân quyền', sub: 'Tài khoản nhân viên & ma trận RBAC', keywords: 'nhan su nhan vien phan quyen rbac employee', icon: UserCog, allowed: permissions.employees },
            { id: 'nav-reviews', tab: 'reviews', label: 'Đánh giá & Phản hồi', sub: 'Review khách hàng sau lưu trú', keywords: 'danh gia phan hoi review rating', icon: Star, allowed: permissions.reviews },
            { id: 'nav-posts', tab: 'posts', label: 'Tin tức & Bài viết', sub: 'Quản trị blog & bài viết du lịch', keywords: 'tin tuc bai viet blog news', icon: Newspaper, allowed: permissions.marketing },
            { id: 'nav-promotions', tab: 'promotions', label: 'Khuyến mãi & Mã giảm giá', sub: 'Voucher, chiến dịch ưu đãi', keywords: 'khuyen mai voucher ma giam gia promo', icon: Tag, allowed: permissions.marketing },
            { id: 'nav-contacts', tab: 'contacts', label: 'Liên hệ khách hàng', sub: 'Hộp thư yêu cầu tư vấn từ website', keywords: 'lien he contact tu van', icon: MessageSquare, allowed: permissions.contacts },
            { id: 'nav-logs', tab: 'audit-logs', label: 'Nhật ký hệ thống (Audit Logs)', sub: 'Lịch sử thao tác nhân viên', keywords: 'nhat ky he thong audit log lich su', icon: ShieldCheck, allowed: permissions.auditLogs },
            { id: 'nav-settings', tab: 'settings', label: 'Cài đặt hệ thống', sub: 'Thông tin khách sạn, logo, ngân hàng', keywords: 'cai dat he thong settings cau hinh', icon: Settings, allowed: permissions.settings }
        ];
        return all.filter((item) => Boolean(item.allowed));
    }, [permissions]);

    // Reset state & focus input khi mở modal
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setBookingResults([]);
            setRoomResults([]);
            setGuestResults([]);
            setIsSearching(false);
            setTimeout(() => inputRef.current?.focus(), 40);
        } else {
            // Xóa cache bookings khi đóng để lần mở sau luôn tươi mới
            cachedBookingsRef.current = null;
        }
    }, [isOpen]);

    // Lọc lối tắt điều hướng tức thì
    const filteredShortcuts = useMemo(() => {
        const q = normalizeText(query);
        if (!q) return navShortcuts.slice(0, 8);
        return navShortcuts
            .filter(
                (item) =>
                    normalizeText(item.label).includes(q) ||
                    normalizeText(item.sub).includes(q) ||
                    normalizeText(item.keywords).includes(q)
            )
            .slice(0, 6);
    }, [query, navShortcuts]);

    // Tìm kiếm dữ liệu thật (Đơn đặt phòng, Phòng, Khách hàng) có debounce 250ms
    useEffect(() => {
        if (!isOpen) return;
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setBookingResults([]);
            setRoomResults([]);
            setGuestResults([]);
            setIsSearching(false);
            return;
        }

        let isCancelled = false;
        const timer = setTimeout(async () => {
            setIsSearching(true);
            const normQ = normalizeText(trimmed);

            try {
                const tasks = [];

                // 1. Tìm kiếm đơn đặt phòng (cache trong phiên mở modal để gõ siêu mượt)
                if (permissions.bookings) {
                    tasks.push(
                        (async () => {
                            let allBookings = cachedBookingsRef.current;
                            if (!allBookings) {
                                const res = await bookingService.getMyBookings({ no_page: 'true' });
                                allBookings = res?.data || res?.results || (Array.isArray(res) ? res : []);
                                cachedBookingsRef.current = allBookings;
                            }
                            return {
                                type: 'bookings',
                                items: allBookings
                                    .filter((b) => {
                                        const hay = normalizeText(
                                            `${b.booking_code || ''} ${b.guest_name || ''} ${b.guest_phone || ''} ${b.identity_card || ''} ${b.room_number || ''} ${b.room_name || ''}`
                                        );
                                        return hay.includes(normQ);
                                    })
                                    .slice(0, 5)
                            };
                        })()
                    );
                }

                // 2. Tìm kiếm phòng thực tế
                if (permissions.rooms) {
                    tasks.push(
                        roomService.getAdminRooms({ q: trimmed }).then((res) => ({
                            type: 'rooms',
                            items: (res?.rooms || []).slice(0, 5)
                        }))
                    );
                }

                // 3. Tìm kiếm khách hàng CRM
                if (permissions.guests) {
                    tasks.push(
                        adminUserService.getGuests({ q: trimmed }).then((res) => ({
                            type: 'guests',
                            items: (res?.guests || res?.data || res?.results || []).slice(0, 5)
                        }))
                    );
                }

                const settled = await Promise.allSettled(tasks);
                if (isCancelled) return;

                let nextBookings = [];
                let nextRooms = [];
                let nextGuests = [];

                settled.forEach((r) => {
                    if (r.status === 'fulfilled' && r.value) {
                        if (r.value.type === 'bookings') nextBookings = r.value.items;
                        if (r.value.type === 'rooms') nextRooms = r.value.items;
                        if (r.value.type === 'guests') nextGuests = r.value.items;
                    }
                });

                setBookingResults(nextBookings);
                setRoomResults(nextRooms);
                setGuestResults(nextGuests);
            } catch (err) {
                console.error('Lỗi tìm kiếm nhanh:', err);
            } finally {
                if (!isCancelled) setIsSearching(false);
            }
        }, 240);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [query, isOpen, permissions.bookings, permissions.rooms, permissions.guests]);

    // Danh sách phẳng tất cả kết quả để điều khiển phím mũi tên lên/xuống/Enter
    const flatItems = useMemo(() => {
        const list = [];
        bookingResults.forEach((b) => list.push({ kind: 'booking', key: `bk-${b.id}`, data: b }));
        roomResults.forEach((r) => list.push({ kind: 'room', key: `rm-${r.id}`, data: r }));
        guestResults.forEach((g) => list.push({ kind: 'guest', key: `gs-${g.id}`, data: g }));
        filteredShortcuts.forEach((s) => list.push({ kind: 'shortcut', key: s.id, data: s }));
        return list;
    }, [bookingResults, roomResults, guestResults, filteredShortcuts]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [flatItems.length, query]);

    const handleActivateItem = (item) => {
        if (!item) return;
        if (item.kind === 'booking') {
            onSelectBooking?.(item.data);
        } else if (item.kind === 'room') {
            onNavigateTab?.('rooms');
        } else if (item.kind === 'guest') {
            onNavigateCustomer?.(item.data.id);
        } else if (item.kind === 'shortcut') {
            onNavigateTab?.(item.data.tab);
        }
        onClose?.();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose?.();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) =>
                flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0
            );
        } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
            e.preventDefault();
            handleActivateItem(flatItems[selectedIndex]);
        }
    };

    // Tự động cuộn mục đang highlight vào khung nhìn
    useEffect(() => {
        if (!listContainerRef.current) return;
        const activeEl = listContainerRef.current.querySelector(`[data-qs-idx="${selectedIndex}"]`);
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    let runningIdx = 0;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] sm:pt-[11vh] px-3 sm:px-4 bg-slate-950/55 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[78vh] animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Sticky Search Header */}
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2.5 bg-white shrink-0">
                    {isSearching ? (
                        <Loader2 className="w-4.5 h-4.5 text-blue-600 animate-spin shrink-0" />
                    ) : (
                        <Search className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Tìm mã đơn, tên/SĐT khách, số phòng hoặc chuyển nhanh phân hệ..."
                        className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                inputRef.current?.focus();
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            title="Xóa từ khóa"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded">
                        ESC
                    </kbd>
                </div>

                {/* Scrollable Results Body */}
                <div ref={listContainerRef} className="flex-1 overflow-y-auto p-2 space-y-3">
                    {/* 1. KẾT QUẢ ĐƠN ĐẶT PHÒNG */}
                    {bookingResults.length > 0 && (
                        <div>
                            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                <span>Đơn đặt phòng ({bookingResults.length})</span>
                                <span className="font-normal normal-case text-slate-400">Nhấn để lọc nhanh</span>
                            </div>
                            <div className="space-y-0.5">
                                {bookingResults.map((b) => {
                                    const idx = runningIdx++;
                                    const isActive = idx === selectedIndex;
                                    const st = BOOKING_STATUS_BADGE[b.status] || {
                                        label: b.status_display || b.status,
                                        cls: 'bg-slate-100 text-slate-600 border-slate-200'
                                    };
                                    return (
                                        <button
                                            key={`bk-${b.id}`}
                                            data-qs-idx={idx}
                                            type="button"
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            onClick={() => handleActivateItem({ kind: 'booking', data: b })}
                                            className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition cursor-pointer ${
                                                isActive ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                                    <Hash className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono font-bold text-xs text-blue-700">
                                                            #{b.booking_code}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 truncate">
                                                            {b.guest_name}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                                                        <span>{b.room_number ? `P.${b.room_number}` : b.room_name || 'Chưa xếp phòng'}</span>
                                                        <span>•</span>
                                                        <span>{formatDateShort(b.check_in_date)} → {formatDateShort(b.check_out_date)}</span>
                                                        {b.guest_phone && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{b.guest_phone}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${st.cls}`}>
                                                {st.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 2. KẾT QUẢ PHÒNG THỰC TẾ */}
                    {roomResults.length > 0 && (
                        <div>
                            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                Phòng thực tế ({roomResults.length})
                            </div>
                            <div className="space-y-0.5">
                                {roomResults.map((r) => {
                                    const idx = runningIdx++;
                                    const isActive = idx === selectedIndex;
                                    const st = ROOM_STATUS_BADGE[r.status] || {
                                        label: r.status_display || r.status,
                                        cls: 'bg-slate-100 text-slate-600 border-slate-200'
                                    };
                                    return (
                                        <button
                                            key={`rm-${r.id}`}
                                            data-qs-idx={idx}
                                            type="button"
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            onClick={() => handleActivateItem({ kind: 'room', data: r })}
                                            className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition cursor-pointer ${
                                                isActive ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    <BedDouble className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-slate-900 truncate">
                                                        Phòng {r.room_number}
                                                        {r.floor !== undefined && r.floor !== null ? ` • Tầng ${r.floor}` : ''}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 truncate">
                                                        {r.category_name || r.category?.name || 'Hạng tiêu chuẩn'}
                                                        {r.current_booking?.guest_name ? ` — Khách: ${r.current_booking.guest_name}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${st.cls}`}>
                                                {st.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. KẾT QUẢ KHÁCH HÀNG CRM */}
                    {guestResults.length > 0 && (
                        <div>
                            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                Hồ sơ Khách hàng CRM ({guestResults.length})
                            </div>
                            <div className="space-y-0.5">
                                {guestResults.map((g) => {
                                    const idx = runningIdx++;
                                    const isActive = idx === selectedIndex;
                                    return (
                                        <button
                                            key={`gs-${g.id}`}
                                            data-qs-idx={idx}
                                            type="button"
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            onClick={() => handleActivateItem({ kind: 'guest', data: g })}
                                            className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition cursor-pointer ${
                                                isActive ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    <Users className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-slate-900 truncate">
                                                        {g.full_name || g.username}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                                                        {g.phone && (
                                                            <span className="inline-flex items-center gap-1">
                                                                <Phone className="w-3 h-3" />
                                                                {g.phone}
                                                            </span>
                                                        )}
                                                        {g.email && <span className="truncate">{g.email}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 shrink-0">
                                                Hồ sơ <ArrowRight className="w-3 h-3" />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 4. ĐIỀU HƯỚNG PHÂN HỆ NHANH */}
                    {filteredShortcuts.length > 0 && (
                        <div>
                            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                {query.trim() ? 'Phân hệ phù hợp' : 'Điều hướng nhanh'}
                            </div>
                            <div className="space-y-0.5">
                                {filteredShortcuts.map((item) => {
                                    const idx = runningIdx++;
                                    const isActive = idx === selectedIndex;
                                    const IconComp = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            data-qs-idx={idx}
                                            type="button"
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            onClick={() => handleActivateItem({ kind: 'shortcut', data: item })}
                                            className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition cursor-pointer ${
                                                isActive ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                    <IconComp className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-slate-900 truncate">
                                                        {item.label}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 truncate">
                                                        {item.sub}
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition ${isActive ? 'text-blue-600 translate-x-0.5' : 'text-slate-300'}`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* EMPTY STATE */}
                    {!isSearching && flatItems.length === 0 && (
                        <div className="py-10 text-center">
                            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-600">
                                Không tìm thấy kết quả phù hợp cho &ldquo;{query}&rdquo;
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Thử tìm theo mã đơn (VD: BK...), số phòng (VD: 201), SĐT hoặc tên khách hàng.
                            </p>
                        </div>
                    )}
                </div>

                {/* Sticky Footer Hints */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[10.5px] text-slate-500 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                            <kbd className="p-0.5 bg-white border border-slate-200 rounded"><ArrowUp className="w-2.5 h-2.5" /></kbd>
                            <kbd className="p-0.5 bg-white border border-slate-200 rounded"><ArrowDown className="w-2.5 h-2.5" /></kbd>
                            Di chuyển
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded flex items-center"><CornerDownLeft className="w-2.5 h-2.5" /></kbd>
                            Mở ngay
                        </span>
                    </div>
                    <span className="text-slate-400 hidden sm:inline">Gõ từ 2 ký tự để tìm dữ liệu trực tiếp</span>
                </div>
            </div>
        </div>
    );
}

