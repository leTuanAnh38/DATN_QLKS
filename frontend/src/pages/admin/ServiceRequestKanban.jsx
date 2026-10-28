import React, { useState, useEffect, useMemo, useRef } from 'react';
import hotelService from '../../services/hotelService';
import {
    Clock,
    ChefHat,
    BellRing,
    CheckCircle2,
    XCircle,
    RotateCcw,
    Printer,
    Eye,
    TrendingUp,
    Plus,
    RefreshCw,
    Search,
    X,
    UtensilsCrossed,
    Sparkles,
    Shirt,
    Lock,
    BedDouble,
    MessageSquare,
    DoorClosed,
    Calendar,
    LayoutList,
    Kanban,
    AlertTriangle,
    CreditCard,
    Gift,
    Undo2,
    ArrowRight
} from 'lucide-react';

// Format thời gian trôi qua dạng "Vừa xong", "5 phút trước", "1 giờ trước"
const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);

        if (diffSec < 60) return 'Vừa đặt lệnh';
        if (diffMin < 60) return `${diffMin} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${d.toLocaleDateString('vi-VN')}`;
    } catch {
        return dateStr;
    }
};

// Format ngày giờ phục vụ chuyên nghiệp (tách giờ và ngày)
const formatRequestDateTime = (dateStr) => {
    if (!dateStr) return { time: '—', date: '' };
    try {
        const d = new Date(dateStr);
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN');
        return { time, date };
    } catch {
        return { time: dateStr, date: '' };
    }
};

// Helper hiển thị icon linh hoạt
const renderIcon = (IconOrComponent, className = 'w-3.5 h-3.5 shrink-0') => {
    if (!IconOrComponent) return null;
    if (typeof IconOrComponent === 'function' || typeof IconOrComponent === 'object') {
        const Comp = IconOrComponent;
        return <Comp className={className} />;
    }
    return <span>{IconOrComponent}</span>;
};

// Cấu hình hiển thị trạng thái dùng cho chế độ xem Danh sách
const STATUS_META = {
    pending: { label: 'Chờ xử lý', icon: Clock, pill: 'bg-amber-50 text-amber-700 border-amber-200', tab: 'bg-amber-500 text-white' },
    in_progress: { label: 'Đang chuẩn bị', icon: ChefHat, pill: 'bg-blue-50 text-blue-700 border-blue-200', tab: 'bg-blue-600 text-white' },
    delivering: { label: 'Đang phục vụ', icon: BellRing, pill: 'bg-purple-50 text-purple-700 border-purple-200', tab: 'bg-purple-600 text-white' },
    completed: { label: 'Hoàn thành', icon: CheckCircle2, pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', tab: 'bg-emerald-600 text-white' },
    cancelled: { label: 'Đã hủy', icon: XCircle, pill: 'bg-rose-50 text-rose-700 border-rose-200', tab: 'bg-rose-600 text-white' }
};
const STATUS_ORDER = ['pending', 'in_progress', 'delivering', 'completed', 'cancelled'];
const LIST_PAGE_SIZE = 10;

// Helper kiểm tra dịch vụ buồng phòng / tiện ích setup phòng trước khi khách tới
const isRoomPrepService = (serviceName = '', categoryName = '') => {
    const sText = (serviceName || '').trim().toLowerCase();
    // Chỉ loại trừ nếu TÊN DỊCH VỤ là giặt ủi (vì danh mục cha là "Tiện ích & Giặt ủi")
    if (['giặt', 'ủi', 'laundry', 'giặt sấy', 'giặt hấp'].some((k) => sText.includes(k))) return false;

    const prepKeywords = [
        'gối', 'khăn', 'tắm', 'buồng phòng', 'tiện ích', 'bàn chải', 'kem đánh răng',
        'dép', 'dọn phòng', 'housekeeping', 'amenities', 'chăn', 'nệm', 'topper',
        'giường phụ', 'nôi', 'trang trí', 'hoa tươi', 'rượu vang', 'setup'
    ];
    const fullText = `${categoryName || ''} ${serviceName || ''}`.trim().toLowerCase();
    return prepKeywords.some((k) => fullText.includes(k));
};

// Helper kiểm tra dịch vụ vận chuyển (xe đưa đón sân bay / ga tàu)
const isTransportService = (serviceName = '', categoryName = '') => {
    const text = `${categoryName || ''} ${serviceName || ''}`.trim().toLowerCase();
    return ['sân bay', 'xe', 'đưa đón', 'transfer', 'airport', 'taxi', 'shuttle', 'đón tiễn'].some((k) => text.includes(k));
};

// Kiểm tra khóa thực hiện dịch vụ:
// - null: Được phép làm
// - 'NO_ROOM': Chưa gán phòng
// - 'WAIT_CHECKIN': Đã gán phòng nhưng chưa Check-in (cho dịch vụ ăn uống, spa, giặt ủi)
const getServiceLockReason = (item) => {
    if (!item) return null;
    if (isTransportService(item.service_name, item.category_name)) return null;

    const hasRoom = item.room_number && item.room_number !== 'Chưa gán phòng' && item.room_number !== 'Chờ xếp';
    if (!hasRoom) return 'NO_ROOM';

    const isCheckedIn = item.booking_status ? item.booking_status === 'checked_in' : false;
    if (isCheckedIn) return null;

    // Đã gán phòng nhưng chưa check-in: Cho phép các dịch vụ tiện nghi buồng phòng / setup phòng
    if (isRoomPrepService(item.service_name, item.category_name)) {
        return null;
    }

    // Các dịch vụ ăn uống nóng, spa, giặt ủi: Yêu cầu khách check-in
    return 'WAIT_CHECKIN';
};

const checkRequiresCheckIn = (item) => Boolean(getServiceLockReason(item));

// Helper kiểm tra và tính toán thời gian quá hạn SLA phục vụ phòng
// QUY TẮC NGHIỆP VỤ:
// - KHÔNG áp dụng cảnh báo SLA cho các đơn ĐẶT TRƯỚC khi khách CHƯA Check-in (vì khách chưa tới khách sạn)
// - KHÔNG áp dụng nếu đơn chưa được xếp phòng (chưa có phòng để phục vụ)
// - Nếu đơn có hẹn giờ (scheduled): Chỉ tính quá hạn khi thời gian hiện tại đã vượt qua giờ hẹn
// - Chỉ tính SLA cho khách ĐÃ CHECK-IN đang lưu trú tại phòng hoặc đơn gọi món trực tiếp
const getSlaStatus = (item) => {
    if (!item || item.status === 'completed' || item.status === 'cancelled') {
        return null;
    }

    // 1. Khách CHƯA Check-in: Đây là đơn đặt kèm khi book phòng (Pre-order), khách chưa ở phòng nên KHÔNG tính SLA quá hạn
    const isCheckedIn = item.booking_status ? item.booking_status === 'checked_in' : false;
    if (!isCheckedIn) {
        return null;
    }

    // 2. Đơn chưa được gán phòng: Chưa thể phục vụ vào phòng, không tính SLA
    const hasRoom = item.room_number && item.room_number !== 'Chưa gán phòng' && item.room_number !== 'Chờ xếp';
    if (!hasRoom) {
        return null;
    }

    // 3. Nếu đơn có hẹn giờ cụ thể (Scheduled request time)
    if (item.is_scheduled && item.request_time) {
        const scheduledTime = new Date(item.request_time);
        if (!isNaN(scheduledTime.getTime())) {
            const diffMinutes = Math.floor((Date.now() - scheduledTime.getTime()) / 60000);
            // Chưa đến giờ hẹn phục vụ -> Không tính quá hạn
            if (diffMinutes < 0) return null;

            // Đã quá giờ hẹn từ 15 phút trở lên mà vẫn chờ xử lý
            if (item.status === 'pending' && diffMinutes >= 15) {
                return {
                    isOverdue: true,
                    label: `Trễ hẹn >${diffMinutes}p`,
                    pill: 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse',
                    borderGlow: 'border-rose-400 ring-2 ring-rose-400/30'
                };
            }
            if (item.status === 'in_progress' && diffMinutes >= 30) {
                return {
                    isOverdue: true,
                    label: `Làm trễ >${diffMinutes}p`,
                    pill: 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse',
                    borderGlow: 'border-rose-400 ring-2 ring-rose-400/30'
                };
            }
            return null;
        }
    }

    // 4. Đơn phục vụ phòng trực tiếp (In-room service) hoặc đơn được kích hoạt sau khi Check-in
    // Dùng updated_at nếu đơn từng là đặt trước được cập nhật lúc check-in, ngược lại dùng created_at
    const baseTimeStr = item.updated_at || item.created_at;
    if (!baseTimeStr) return null;
    const d = new Date(baseTimeStr);
    if (isNaN(d.getTime())) return null;

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));

    if (item.status === 'pending' && elapsedMinutes >= 15) {
        return {
            isOverdue: true,
            label: `Chờ >${elapsedMinutes}p`,
            pill: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse',
            borderGlow: 'border-amber-400 ring-2 ring-amber-400/30'
        };
    }
    if (item.status === 'in_progress' && elapsedMinutes >= 30) {
        return {
            isOverdue: true,
            label: `Làm >${elapsedMinutes}p`,
            pill: 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse',
            borderGlow: 'border-rose-400 ring-2 ring-rose-400/30'
        };
    }
    if (item.status === 'delivering' && elapsedMinutes >= 20) {
        return {
            isOverdue: true,
            label: `Giao >${elapsedMinutes}p`,
            pill: 'bg-purple-100 text-purple-900 border-purple-300 animate-pulse',
            borderGlow: 'border-purple-400 ring-2 ring-purple-400/30'
        };
    }
    return null;
};

// In phiếu phục vụ phòng (Room Service Tray Slip)
const handlePrintSlip = (item) => {
    if (!item) return;
    const printWindow = window.open('', '_blank', 'width=620,height=780');
    if (!printWindow) {
        alert('Trình duyệt đã chặn cửa sổ pop-up in. Vui lòng cho phép mở pop-up.');
        return;
    }
    const createdStr = item.created_at
        ? `${new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${new Date(item.created_at).toLocaleDateString('vi-VN')}`
        : '—';
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Phiếu Dịch Vụ #${item.id} - Phòng ${item.room_number || ''}</title>
            <meta charset="utf-8" />
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 440px; margin: 0 auto; line-height: 1.5; }
                .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 12px; margin-bottom: 14px; }
                .hotel-name { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; margin: 0; color: #0f172a; }
                .hotel-sub { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-top: 3px; }
                .title { font-size: 15px; font-weight: 800; text-transform: uppercase; margin: 10px 0 6px 0; color: #2563eb; }
                .room-badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 5px 12px; border-radius: 8px; font-size: 17px; font-weight: 800; margin: 6px 0; border: 1.5px solid #bfdbfe; }
                .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
                .meta-label { color: #64748b; }
                .meta-value { font-weight: 600; color: #0f172a; }
                .item-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
                .item-table th { border-bottom: 1px solid #cbd5e1; text-align: left; padding: 6px 0; color: #475569; font-size: 11px; text-transform: uppercase; }
                .item-table td { padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
                .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #e11d48; margin-top: 10px; padding-top: 8px; border-top: 2px solid #0f172a; }
                .note-box { background: #fefce8; border: 1px solid #fde047; padding: 10px; border-radius: 8px; font-size: 12px; margin: 12px 0; font-style: italic; color: #854d0e; }
                .signature-section { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 12px; text-align: center; font-size: 12px; }
                .sig-line { margin-top: 45px; border-top: 1px solid #94a3b8; width: 130px; }
                .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; border-top: 1px dashed #e2e8f0; padding-top: 10px; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="hotel-name">TA LUXURY HOTEL DA NANG</h1>
                <div class="hotel-sub">${(item.category_name || '').toLowerCase().includes('buồng') || (item.service_name || '').toLowerCase().includes('dọn') ? 'Bộ phận Buồng phòng & Tiện ích lưu trú (Housekeeping)' : 'Dịch vụ Ẩm thực & Phục vụ phòng (In-Room Dining)'}</div>
                <div class="title">${(item.category_name || '').toLowerCase().includes('buồng') || (item.service_name || '').toLowerCase().includes('dọn') ? 'PHIẾU YÊU CẦU BUỒNG PHÒNG' : 'PHIẾU PHỤC VỤ TẠI PHÒNG'}</div>
                <div class="room-badge">🚪 PHÒNG ${item.room_number || 'Chưa gán'}</div>
            </div>

            <div class="meta-row">
                <span class="meta-label">Mã yêu cầu:</span>
                <span class="meta-value">#SR-${item.id}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">Mã đặt phòng:</span>
                <span class="meta-value">#${item.booking_code || '—'}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">Khách hàng:</span>
                <span class="meta-value">${item.guest_name || 'Khách lưu trú'}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">Thời gian đặt:</span>
                <span class="meta-value">${createdStr}</span>
            </div>
            ${item.is_scheduled && item.request_time ? `
            <div class="meta-row" style="color: #4338ca; font-weight: 700;">
                <span class="meta-label">⏰ Giờ hẹn phục vụ:</span>
                <span class="meta-value">${new Date(item.request_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>` : ''}

            <table class="item-table">
                <thead>
                    <tr>
                        <th>Món / Dịch vụ</th>
                        <th style="text-align: center;">SL</th>
                        <th style="text-align: right;">Đơn giá</th>
                        <th style="text-align: right;">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>${item.service_name}</strong>
                            <div style="font-size: 11px; color: #64748b;">${item.category_name || 'Dịch vụ'}</div>
                        </td>
                        <td style="text-align: center; font-weight: 700;">x${item.quantity || 1}</td>
                        <td style="text-align: right;">${Number(item.unit_price || 0).toLocaleString('vi-VN')} đ</td>
                        <td style="text-align: right; font-weight: 700;">${Number(item.total_price || 0).toLocaleString('vi-VN')} đ</td>
                    </tr>
                </tbody>
            </table>

            <div class="total-row">
                <span>TỔNG CỘNG:</span>
                <span>${Number(item.total_price || 0).toLocaleString('vi-VN')} VND</span>
            </div>

            <div class="meta-row" style="margin-top: 8px;">
                <span class="meta-label">Thanh toán:</span>
                <span class="meta-value" style="color: ${item.is_paid ? '#059669' : '#d97706'}; font-weight: 700;">
                    ${item.is_paid ? '🟢 ĐÃ THANH TOÁN TRƯỚC' : '🟠 TÍNH VÀO HÓA ĐƠN CHECK-OUT'}
                </span>
            </div>

            ${item.note ? `
            <div class="note-box">
                <strong>Ghi chú của khách:</strong> "${item.note}"
            </div>` : ''}

            <div class="signature-section">
                <div>
                    <div>Nhân viên phục vụ</div>
                    <div class="sig-line"></div>
                </div>
                <div>
                    <div>Khách hàng ký nhận</div>
                    <div class="sig-line"></div>
                </div>
            </div>

            <div class="footer">
                Khách Sạn TA Luxury Đà Nẵng • Hotline Room Service: Máy lẻ 101<br/>
                Chúc quý khách có trải nghiệm ẩm thực ngon miệng & hài lòng!
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

export default function ServiceRequestKanban() {
    // 1. Data States
    const [kanbanData, setKanbanData] = useState({
        pending: [],
        in_progress: [],
        delivering: [],
        completed: [],
        cancelled: [],
        stats: { total: 0, pending_count: 0, in_progress_count: 0, delivering_count: 0, completed_count: 0, total_revenue: 0 }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdatingId, setIsUpdatingId] = useState(null);

    // 2. Filter & Search
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [showCancelled, setShowCancelled] = useState(false);

    // Số lượng đơn Hoàn thành hiển thị tối đa trên cột Kanban (mặc định 8 đơn mới nhất để giữ bảng gọn gàng)
    const [completedDisplayCount, setCompletedDisplayCount] = useState(8);

    // Chế độ xem: 'list' (mỗi yêu cầu 1 hàng) | 'board' (Kanban kéo thả)
    const [viewMode, setViewMode] = useState('list');
    const [statusTab, setStatusTab] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);

    // 3. Drag and Drop States
    const [draggedItemId, setDraggedItemId] = useState(null);
    const [activeDropZone, setActiveDropZone] = useState(null); // 'pending' | 'in_progress' | 'completed'

    // 4. Modal Tạo yêu cầu dịch vụ mới (Đặt món tại phòng)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeBookings, setActiveBookings] = useState([]);
    const [serviceCatalog, setServiceCatalog] = useState([]);
    const [isLoadingModalData, setIsLoadingModalData] = useState(false);
    const [modalSubmitting, setModalSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');
    const [selectedBookingId, setSelectedBookingId] = useState('');
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [orderQuantity, setOrderQuantity] = useState(1);
    const [orderNote, setOrderNote] = useState('');
    const [modalServiceSearch, setModalServiceSearch] = useState('');
    const [modalCategoryFilter, setModalCategoryFilter] = useState('all');

    // 5. Modal Chi tiết yêu cầu
    const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);

    // 6. Toast
    const [toast, setToast] = useState(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    // Tải dữ liệu Kanban từ API
    const fetchKanbanData = async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoading(true);
            const res = await hotelService.getKanbanRequests();
            if (res && res.success) {
                setKanbanData(res.kanban);
            } else if (!isSilent) {
                showToast('error', res?.message || 'Không thể tải bảng điều phối dịch vụ.');
            }
        } catch (error) {
            if (!isSilent) showToast('error', 'Lỗi kết nối khi tải Kanban.');
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKanbanData();

        // 1. Polling tự động mỗi 6 giây để nhân viên nhận đơn mới ngay lập tức
        const interval = setInterval(() => {
            fetchKanbanData(true);
        }, 6000);

        // 2. Lắng nghe sự kiện khách vừa gọi dịch vụ ở tab khác (cross-tab sync)
        const handleStorage = (e) => {
            if (e.key === 'pms_last_service_event') {
                fetchKanbanData(true);
            }
        };
        const handleCustomService = () => fetchKanbanData(true);

        window.addEventListener('storage', handleStorage);
        window.addEventListener('pms_service_created', handleCustomService);
        window.addEventListener('pms_service_updated', handleCustomService);
        window.addEventListener('focus', () => fetchKanbanData(true));

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('pms_service_created', handleCustomService);
            window.removeEventListener('pms_service_updated', handleCustomService);
        };
    }, []);

    // Xử lý cập nhật trạng thái thẻ (Dùng chung cho cả Drag & Drop và Nút bấm)
    const handleUpdateStatus = async (itemId, newStatus) => {
        if (!itemId || !newStatus) return;

        // Tìm thẻ hiện tại trong state
        let currentItem = null;
        let sourceColumn = null;
        for (const col of ['pending', 'in_progress', 'delivering', 'completed', 'cancelled']) {
            const found = kanbanData[col]?.find((item) => item.id === itemId);
            if (found) {
                currentItem = found;
                sourceColumn = col;
                break;
            }
        }

        if (!currentItem || sourceColumn === newStatus) return;

        // 🔒 CHẶN THAY ĐỔI TRẠNG THÁI NẾU ĐƠN ĐÃ HOÀN THÀNH (ĐÃ TÍNH VÀO HÓA ĐƠN)
        if (currentItem.status === 'completed' || sourceColumn === 'completed') {
            showToast('warning', 'Yêu cầu dịch vụ này đã hoàn thành và được tính vào hóa đơn phòng, không thể thay đổi trạng thái.');
            return;
        }

        // 🔒 CHẶN BẮT ĐẦU / THỰC HIỆN DỊCH VỤ NẾU CHƯA ĐỦ ĐIỀU KIỆN
        const lockReason = getServiceLockReason(currentItem);
        if (['in_progress', 'delivering', 'completed'].includes(newStatus) && lockReason) {
            if (lockReason === 'NO_ROOM') {
                showToast('warning', `Đơn phòng #${currentItem.booking_code} chưa được gán phòng cụ thể. Vui lòng liên hệ Lễ tân gán phòng trước khi thực hiện dịch vụ!`);
            } else {
                showToast('warning', `Đơn phòng #${currentItem.booking_code} chưa làm thủ tục nhận phòng. Dịch vụ ẩm thực / spa / giặt ủi yêu cầu khách có mặt tại phòng để phục vụ!`);
            }
            return;
        }

        // Lưu bản sao cũ để rollback nếu lỗi
        const previousState = { ...kanbanData };

        // Cập nhật Optimistic trên UI
        setKanbanData((prev) => {
            const updatedItem = { ...currentItem, status: newStatus };
            const newSourceList = prev[sourceColumn].filter((i) => i.id !== itemId);
            const newTargetList = [updatedItem, ...prev[newStatus]];

            return {
                ...prev,
                [sourceColumn]: newSourceList,
                [newStatus]: newTargetList,
                stats: {
                    ...prev.stats,
                    pending_count: newStatus === 'pending' ? prev.stats.pending_count + 1 : (sourceColumn === 'pending' ? prev.stats.pending_count - 1 : prev.stats.pending_count),
                    in_progress_count: newStatus === 'in_progress' ? prev.stats.in_progress_count + 1 : (sourceColumn === 'in_progress' ? prev.stats.in_progress_count - 1 : prev.stats.in_progress_count),
                    delivering_count: newStatus === 'delivering' ? (prev.stats.delivering_count || 0) + 1 : (sourceColumn === 'delivering' ? Math.max(0, (prev.stats.delivering_count || 1) - 1) : (prev.stats.delivering_count || 0)),
                    completed_count: newStatus === 'completed' ? prev.stats.completed_count + 1 : (sourceColumn === 'completed' ? prev.stats.completed_count - 1 : prev.stats.completed_count)
                }
            };
        });

        try {
            setIsUpdatingId(itemId);
            const res = await hotelService.updateServiceRequestStatus(itemId, newStatus);

            if (res && res.success) {
                if (newStatus === 'completed') {
                    showToast('success', `Đã giao thành công cho khách hàng phòng ${currentItem.room_number || ''}! (Đã ghi nhận vào hóa đơn phòng)`);
                } else if (newStatus === 'delivering') {
                    showToast('success', `Đã chuyển yêu cầu phòng ${currentItem.room_number || ''} sang "Đang giao". Nhân viên đang đưa lên phòng!`);
                } else {
                    const statusLabels = {
                        pending: 'Chờ xử lý',
                        in_progress: 'Đang làm',
                        delivering: 'Đang giao',
                        completed: 'Hoàn thành (Đã ghi nhận vào hóa đơn phòng)',
                        cancelled: 'Đã hủy'
                    };
                    showToast('success', `Đã chuyển yêu cầu phòng ${currentItem.room_number || ''} sang "${statusLabels[newStatus]}".`);
                }
                fetchKanbanData(true);
            } else {
                setKanbanData(previousState);
                showToast('error', res?.message || 'Không thể chuyển trạng thái.');
            }
        } catch (error) {
            setKanbanData(previousState);
            showToast('error', error.message || 'Lỗi kết nối máy chủ.');
        } finally {
            setIsUpdatingId(null);
        }
    };

    // =========================================================================
    // DRAG AND DROP HANDLERS (HTML5 NATIVE API)
    // =========================================================================
    const handleDragStart = (e, itemOrId) => {
        const itemId = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
        const itemStatus = typeof itemOrId === 'object' ? itemOrId.status : null;

        if (itemStatus === 'completed') {
            e.preventDefault();
            return;
        }

        setDraggedItemId(itemId);
        e.dataTransfer.setData('text/plain', String(itemId));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, columnKey) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (activeDropZone !== columnKey) {
            setActiveDropZone(columnKey);
        }
    };

    const handleDragLeave = (e) => {
        // Chỉ reset khi rời hẳn khỏi container cột
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setActiveDropZone(null);
        }
    };

    const handleDrop = (e, targetColumnKey) => {
        e.preventDefault();
        setActiveDropZone(null);
        const itemIdStr = e.dataTransfer.getData('text/plain') || draggedItemId;
        const itemId = Number(itemIdStr);

        if (itemId) {
            handleUpdateStatus(itemId, targetColumnKey);
        }
        setDraggedItemId(null);
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setActiveDropZone(null);
    };

    // =========================================================================
    // MODAL TẠO YÊU CẦU DỊCH VỤ MỚI CHO PHÒNG LƯU TRÚ (IN-ROOM ORDER POS)
    // =========================================================================
    const handleOpenCreateModal = async () => {
        setIsCreateModalOpen(true);
        setModalError('');
        setSelectedBookingId('');
        setSelectedServiceId('');
        setOrderQuantity(1);
        setOrderNote('');
        setModalServiceSearch('');
        setModalCategoryFilter('all');

        setIsLoadingModalData(true);
        try {
            const [bookingsRes, servicesRes] = await Promise.all([
                hotelService.getMyActiveBookings(),
                hotelService.getServices({ status: 'active', all: true })
            ]);

            if (bookingsRes && bookingsRes.success && Array.isArray(bookingsRes.bookings)) {
                setActiveBookings(bookingsRes.bookings);
                if (bookingsRes.bookings.length > 0) {
                    setSelectedBookingId(String(bookingsRes.bookings[0].id));
                }
            }

            if (servicesRes && servicesRes.success && Array.isArray(servicesRes.items)) {
                setServiceCatalog(servicesRes.items);
                if (servicesRes.items.length > 0) {
                    setSelectedServiceId(String(servicesRes.items[0].id));
                }
            }
        } catch (err) {
            console.error('Lỗi khi tải dữ liệu tạo đơn:', err);
            setModalError('Không thể tải danh sách phòng hoặc thực đơn.');
        } finally {
            setIsLoadingModalData(false);
        }
    };

    const handleCreateServiceRequest = async (e) => {
        e.preventDefault();
        setModalError('');
        if (!selectedBookingId) {
            setModalError('Vui lòng chọn phòng đang lưu trú của khách.');
            return;
        }
        if (!selectedServiceId) {
            setModalError('Vui lòng chọn món ăn / dịch vụ cần phục vụ.');
            return;
        }
        if (!orderQuantity || Number(orderQuantity) < 1) {
            setModalError('Số lượng phải từ 1 trở lên.');
            return;
        }

        setModalSubmitting(true);
        try {
            const payload = {
                booking_id: Number(selectedBookingId),
                service_id: Number(selectedServiceId),
                quantity: Number(orderQuantity),
                note: orderNote.trim()
            };
            const res = await hotelService.createServiceRequest(payload);
            if (res && res.success) {
                const bk = activeBookings.find((b) => String(b.id) === String(selectedBookingId));
                const srv = serviceCatalog.find((s) => String(s.id) === String(selectedServiceId));
                showToast('success', `Đã tạo yêu cầu "${srv?.name || 'món'}" cho Phòng ${bk?.room_number || ''} thành công!`);
                setIsCreateModalOpen(false);
                fetchKanbanData(true);
            } else {
                setModalError(res?.message || 'Không thể tạo yêu cầu dịch vụ.');
            }
        } catch (err) {
            setModalError(err.message || 'Lỗi khi kết nối máy chủ.');
        } finally {
            setModalSubmitting(false);
        }
    };

    const modalSelectedService = useMemo(() => {
        return serviceCatalog.find((s) => String(s.id) === String(selectedServiceId));
    }, [serviceCatalog, selectedServiceId]);

    const filteredModalServices = useMemo(() => {
        return serviceCatalog.filter((item) => {
            const matchSearch =
                !modalServiceSearch.trim() ||
                item.name?.toLowerCase().includes(modalServiceSearch.trim().toLowerCase()) ||
                item.description?.toLowerCase().includes(modalServiceSearch.trim().toLowerCase());
            const matchCat =
                modalCategoryFilter === 'all' ||
                String(item.category?.id || item.category_id) === String(modalCategoryFilter) ||
                item.category_name?.toLowerCase().includes(modalCategoryFilter.toLowerCase());
            return matchSearch && matchCat;
        });
    }, [serviceCatalog, modalServiceSearch, modalCategoryFilter]);

    const modalServiceCategories = useMemo(() => {
        const cats = new Map();
        serviceCatalog.forEach((item) => {
            if (item.category && item.category.name) {
                cats.set(item.category.id, item.category.name);
            } else if (item.category_name) {
                cats.set(item.category_name, item.category_name);
            }
        });
        return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
    }, [serviceCatalog]);

    // Lọc danh sách thẻ trong từng cột theo từ khóa tìm kiếm
    const filterColumnItems = (items = []) => {
        if (!searchKeyword.trim() && selectedCategoryFilter === 'all') {
            return items;
        }

        return items.filter((item) => {
            const q = searchKeyword.trim().toLowerCase();
            const matchSearch =
                !q ||
                String(item.room_number).toLowerCase().includes(q) ||
                item.service_name?.toLowerCase().includes(q) ||
                item.guest_name?.toLowerCase().includes(q) ||
                item.booking_code?.toLowerCase().includes(q) ||
                item.note?.toLowerCase().includes(q);

            const matchCat =
                selectedCategoryFilter === 'all' ||
                item.category_name?.toLowerCase().includes(selectedCategoryFilter.toLowerCase());

            return matchSearch && matchCat;
        });
    };

    // Cấu hình hiển thị 4 cột chính
    const columns = [
        {
            key: 'pending',
            title: 'Chờ xử lý (Pending)',
            icon: Clock,
            headerBg: 'bg-amber-500/10 text-amber-800 border-amber-300',
            badgeBg: 'bg-amber-500 text-white',
            borderColor: 'border-amber-200',
            accentHover: 'hover:border-amber-400',
            dropHighlight: 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30'
        },
        {
            key: 'in_progress',
            title: 'Đang chuẩn bị (In Progress)',
            icon: ChefHat,
            headerBg: 'bg-blue-500/10 text-blue-800 border-blue-300',
            badgeBg: 'bg-blue-600 text-white',
            borderColor: 'border-blue-200',
            accentHover: 'hover:border-blue-400',
            dropHighlight: 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/30'
        },
        {
            key: 'delivering',
            title: 'Đang phục vụ (Delivering / Serving)',
            icon: BellRing,
            headerBg: 'bg-purple-500/10 text-purple-800 border-purple-300',
            badgeBg: 'bg-purple-600 text-white',
            borderColor: 'border-purple-200',
            accentHover: 'hover:border-purple-400',
            dropHighlight: 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/30'
        },
        {
            key: 'completed',
            title: 'Hoàn thành (Completed)',
            icon: CheckCircle2,
            headerBg: 'bg-emerald-500/10 text-emerald-800 border-emerald-300',
            badgeBg: 'bg-emerald-600 text-white',
            borderColor: 'border-emerald-200',
            accentHover: 'hover:border-emerald-400',
            dropHighlight: 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/30'
        }
    ];

    const stats = kanbanData.stats || {};

    // =========================================================================
    // CHẾ ĐỘ XEM DANH SÁCH (1 HÀNG / YÊU CẦU) + PHÂN TRANG
    // =========================================================================
    const allListItems = STATUS_ORDER.flatMap((key) =>
        filterColumnItems(kanbanData[key] || []).map((item) => ({ ...item, status: key }))
    );

    const statusTabs = [
        { key: 'all', label: 'Tất cả', icon: LayoutList, count: allListItems.length },
        ...STATUS_ORDER.map((key) => ({
            key,
            label: STATUS_META[key].label,
            icon: STATUS_META[key].icon,
            count: allListItems.filter((i) => i.status === key).length
        }))
    ];

    // Đơn chờ xử lý lên đầu, trong cùng trạng thái thì mới nhất trước
    const listItems = (statusTab === 'all' ? allListItems : allListItems.filter((i) => i.status === statusTab))
        .slice()
        .sort((a, b) => {
            if (statusTab === 'all' && a.status !== b.status) {
                return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
            }
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

    const listTotalPages = Math.max(1, Math.ceil(listItems.length / LIST_PAGE_SIZE));
    const safePage = Math.min(currentPage, listTotalPages);
    const pageStartIndex = (safePage - 1) * LIST_PAGE_SIZE;
    const paginatedListItems = listItems.slice(pageStartIndex, pageStartIndex + LIST_PAGE_SIZE);

    // Về trang 1 và đặt lại giới hạn đơn hoàn thành khi đổi từ khóa, tab trạng thái hoặc chế độ xem
    useEffect(() => {
        setCurrentPage(1);
        setCompletedDisplayCount(8);
    }, [searchKeyword, selectedCategoryFilter, statusTab, viewMode]);

    const handleListPageChange = (page) => {
        if (page < 1 || page > listTotalPages || page === safePage) return;
        setCurrentPage(page);
        const el = document.getElementById('service-request-list');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const listPageNumbers = (() => {
        if (listTotalPages <= 7) return Array.from({ length: listTotalPages }, (_, i) => i + 1);
        const pages = [1];
        const start = Math.max(2, safePage - 1);
        const end = Math.min(listTotalPages - 1, safePage + 1);
        if (start > 2) pages.push('ellipsis-left');
        for (let p = start; p <= end; p++) pages.push(p);
        if (end < listTotalPages - 1) pages.push('ellipsis-right');
        pages.push(listTotalPages);
        return pages;
    })();

    return (
        <div className="space-y-6">
            {/* TOAST THÔNG BÁO */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 animate-bounce">
                    <div
                        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-xs font-semibold backdrop-blur-md ${
                            toast.type === 'success'
                                ? 'bg-emerald-900/90 text-white border border-emerald-500/40 shadow-emerald-900/30'
                                : 'bg-rose-900/90 text-white border border-rose-500/40 shadow-rose-900/30'
                        }`}
                    >
                        <span className="text-base">{toast.type === 'success' ? '✅' : '⚠️'}</span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            {/* HEADER CHÍNH: TIÊU ĐỀ + DOANH THU & NÚT THAO TÁC (TINH GỌN, SANG TRỌNG) */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                            Quản Lý Yêu Cầu Dịch Vụ Tại Phòng
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1.5">
                            <UtensilsCrossed className="w-3.5 h-3.5 text-blue-600" />
                            <span>{stats.total || 0} yêu cầu</span>
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Điều phối gọi món ăn uống (In-Room Dining), spa trị liệu và tiện ích phục vụ khách lưu trú
                    </p>
                </div>

                {/* Cụm Thống kê Doanh thu & Nhóm nút Hành động */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    {/* Thẻ Doanh thu nổi bật */}
                    <div className="flex items-center gap-2.5 px-3.5 py-2 bg-gradient-to-r from-emerald-50 via-teal-50/80 to-emerald-50 border border-emerald-200/90 rounded-2xl shadow-2xs">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-700 shrink-0">
                            <TrendingUp className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                                Doanh thu hoàn tất
                            </span>
                            <span className="text-xs sm:text-sm font-black text-emerald-900 whitespace-nowrap">
                                {Number(stats.total_revenue || 0).toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                    </div>

                    {/* Bộ chuyển chế độ xem: Danh sách vs Kanban */}
                    <div className="bg-slate-100 p-1 rounded-2xl flex items-center text-xs font-semibold text-slate-600 border border-slate-200/60">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                                viewMode === 'list'
                                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Chế độ xem bảng danh sách 1 hàng"
                        >
                            <LayoutList className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Danh sách</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('board')}
                            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                                viewMode === 'board'
                                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Chế độ xem bảng Kanban kéo thả"
                        >
                            <Kanban className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Kanban</span>
                        </button>
                    </div>

                    {/* Nút Làm mới */}
                    <button
                        type="button"
                        onClick={() => fetchKanbanData(false)}
                        disabled={isLoading}
                        className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200/60 active:scale-95"
                        title="Đồng bộ lại dữ liệu mới nhất"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
                        <span className="hidden md:inline">Làm mới</span>
                    </button>

                    {/* Nút Tạo đơn / Đặt món cho khách */}
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer active:scale-95"
                        title="Đặt món ăn / đồ uống / dịch vụ cho phòng đang lưu trú"
                    >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span className="whitespace-nowrap">Đặt món tại phòng</span>
                    </button>
                </div>
            </div>

            {/* THANH TÌM KIẾM & BỘ LỌC CHUYÊN MÔN NGHIỆP VỤ (GỌN GÀNG, 1 HÀNG DUY NHẤT) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
                {/* Ô tìm kiếm nhanh */}
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="Tìm số phòng, tên khách, món ăn, mã đơn..."
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    {searchKeyword && (
                        <button
                            type="button"
                            onClick={() => setSearchKeyword('')}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Nhóm nút lọc Danh mục nghiệp vụ - Xếp đều 1 hàng, không bị rớt dòng */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                    {[
                        { key: 'all', label: 'Tất cả', icon: null },
                        { key: 'ẩm thực', label: 'Ẩm thực (F&B)', icon: UtensilsCrossed },
                        { key: 'spa', label: 'Spa & Trị liệu', icon: Sparkles },
                        { key: 'giặt', label: 'Tiện ích & Giặt ủi', icon: Shirt },
                    ].map((cat) => {
                        const CatIcon = cat.icon;
                        return (
                            <button
                                key={cat.key}
                                type="button"
                                onClick={() => setSelectedCategoryFilter(cat.key)}
                                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer text-xs whitespace-nowrap border flex items-center gap-1.5 ${
                                    selectedCategoryFilter === cat.key
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/80'
                                }`}
                            >
                                {CatIcon && <CatIcon className="w-3.5 h-3.5 shrink-0" />}
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}

                    {viewMode === 'board' && (
                        <button
                            type="button"
                            onClick={() => setShowCancelled(!showCancelled)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border whitespace-nowrap ml-1 flex items-center gap-1.5 ${
                                showCancelled
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Đơn đã hủy ({kanbanData.cancelled?.length || 0})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* CHẾ ĐỘ DANH SÁCH: MỖI YÊU CẦU 1 HÀNG (giống Quản lý đơn đặt phòng) */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    {/* Tab lọc theo trạng thái (Sticky trên Mobile để dễ chuyển tab khi cuộn) */}
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md flex items-center gap-2 overflow-x-auto px-4 py-3 border-b border-slate-100 scrollbar-none">
                        {statusTabs.map((tab) => {
                            const isActive = statusTab === tab.key;
                            const activeCls = tab.key === 'all' ? 'bg-blue-50 text-blue-700 border-blue-200' : STATUS_META[tab.key].tab;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStatusTab(tab.key)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                                        isActive
                                            ? `${activeCls} border-transparent shadow-md`
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {renderIcon(tab.icon, "w-3.5 h-3.5 shrink-0")}
                                    <span>{tab.label}</span>
                                    <span className={`px-1.5 rounded-full text-[10px] font-mono ${isActive ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* BẢNG CHO MÀN HÌNH MÁY TÍNH (>= md) */}
                    <div id="service-request-list" className="hidden md:block overflow-x-auto scroll-mt-4">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                                    <th className="py-3 px-4 whitespace-nowrap">Phòng & Mã Đơn</th>
                                    <th className="py-3 px-4 min-w-[130px]">Khách Hàng</th>
                                    <th className="py-3 px-4 min-w-[240px]">Dịch Vụ Yêu Cầu</th>
                                    <th className="py-3 px-4 whitespace-nowrap text-right">Chi Phí & Số Lượng</th>
                                    <th className="py-3 px-4 whitespace-nowrap">Thời Gian</th>
                                    <th className="py-3 px-4 text-center whitespace-nowrap">Trạng Thái & Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {isLoading && allListItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                            <span>Đang tải danh sách yêu cầu dịch vụ...</span>
                                        </td>
                                    </tr>
                                )}

                                {!isLoading && listItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                            <div className="text-3xl mb-2">📭</div>
                                            <p className="font-semibold text-slate-700">Không có yêu cầu dịch vụ nào</p>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                {searchKeyword ? 'Hãy thử tìm kiếm với từ khóa khác.' : 'Chưa có yêu cầu nào trong mục này.'}
                                            </p>
                                        </td>
                                    </tr>
                                )}

                                {paginatedListItems.map((item) => {
                                    const meta = STATUS_META[item.status];
                                    const isUpdatingThis = isUpdatingId === item.id;
                                    const totalAmt = Number(item.total_price) || 0;
                                    const needsCheckIn = checkRequiresCheckIn(item);
                                    const sla = getSlaStatus(item);

                                    return (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-blue-50/25 transition duration-150 ${isUpdatingThis ? 'opacity-60 bg-slate-50' : ''}`}
                                        >
                                            {/* 1. Phòng / Mã đơn */}
                                            <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 font-mono font-black text-xs shadow-2xs">
                                                    <DoorClosed className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                    <span>{item.room_number ? `Phòng ${item.room_number}` : 'Chờ xếp'}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 block mt-1 font-mono tracking-tight font-medium">
                                                    #{item.booking_code}
                                                </span>
                                                {sla && (
                                                    <div className="mt-1">
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${sla.pill}`}>
                                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                                            <span>{sla.label}</span>
                                                        </span>
                                                    </div>
                                                )}
                                                {item.status === 'pending' && (
                                                    <div className="mt-1">
                                                        {getServiceLockReason(item) === 'NO_ROOM' && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold" title="Chưa gán số phòng cụ thể">
                                                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Chưa gán phòng
                                                            </span>
                                                        )}
                                                        {getServiceLockReason(item) === 'WAIT_CHECKIN' && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold" title="Dịch vụ ăn uống / spa yêu cầu khách nhận phòng trước khi phục vụ">
                                                                <Lock className="w-2.5 h-2.5 shrink-0" /> Chờ Check-in
                                                            </span>
                                                        )}
                                                        {!getServiceLockReason(item) && isRoomPrepService(item.service_name, item.category_name) && item.booking_status !== 'checked_in' && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-bold" title="Đã có số phòng! Nhân viên buồng phòng có thể chuẩn bị gối khăn / tiện nghi vào phòng trước khi khách tới">
                                                                <BedDouble className="w-2.5 h-2.5 shrink-0" /> Setup phòng
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* 2. Khách hàng */}
                                            <td className="py-3.5 px-4 min-w-[130px] max-w-[180px] align-middle">
                                                <div className="font-bold text-slate-900 text-xs truncate" title={item.guest_name}>
                                                    {item.guest_name || 'Khách lưu trú'}
                                                </div>
                                                <span className="text-[11px] text-slate-400 block mt-0.5">
                                                    Khách lưu trú
                                                </span>
                                            </td>

                                            {/* 3. Dịch vụ yêu cầu */}
                                            <td className="py-3.5 px-4 min-w-[240px] max-w-[360px] align-middle">
                                                <div className="flex items-center gap-3">
                                                    {item.service_image ? (
                                                        <img
                                                            src={item.service_image}
                                                            alt={item.service_name}
                                                            className="w-11 h-11 rounded-xl object-cover border border-slate-200/80 shrink-0 shadow-2xs"
                                                        />
                                                    ) : (
                                                        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 border border-slate-200/60">
                                                            <UtensilsCrossed className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-slate-900 text-xs sm:text-[13px] truncate" title={item.service_name}>
                                                            {item.service_name}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                            <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200/70">
                                                                {item.category_name || 'Dịch vụ'}
                                                            </span>
                                                            {totalAmt === 0 ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-semibold shadow-2xs">
                                                                    <Gift className="w-2.5 h-2.5 text-emerald-600" />
                                                                    <span>Tiện ích miễn phí</span>
                                                                </span>
                                                            ) : item.is_paid ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-semibold shadow-2xs">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    <span>Đã trả trước</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-semibold shadow-2xs">
                                                                    <CreditCard className="w-2.5 h-2.5 text-amber-600" />
                                                                    <span>Thu Check-out</span>
                                                                </span>
                                                            )}
                                                            {item.is_scheduled && item.request_time && item.status !== 'completed' && item.status !== 'cancelled' && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold shadow-2xs">
                                                                    <Clock className="w-2.5 h-2.5 text-indigo-600" />
                                                                    <span>Hẹn {new Date(item.request_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.note && (
                                                            <div className="text-[11px] text-slate-500 italic truncate mt-1 flex items-center gap-1.5" title={item.note}>
                                                                <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                                                                <span className="truncate">{item.note}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 4. Chi phí & Số lượng gộp chung */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-right align-middle">
                                                <div className="font-black text-rose-600 text-sm tracking-tight">
                                                    {totalAmt.toLocaleString('vi-VN')} đ
                                                </div>
                                                <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                                                    x{item.quantity || 1} suất
                                                </span>
                                            </td>

                                            {/* 5. Thời gian (2 dòng rõ ràng, chuẩn khách sạn) */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 align-middle">
                                                {(() => {
                                                    const timeInfo = formatRequestDateTime(item.created_at);
                                                    return (
                                                        <div>
                                                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                <span>{timeInfo.time}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-medium pl-5 mt-0.5">
                                                                {timeInfo.date}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* 6. Trạng thái & Thao tác (Gộp chung 1 cột duy nhất, chuẩn 5 sao) */}
                                            <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                                                <div className="flex items-center justify-center">
                                                    {item.status === 'completed' && (
                                                        <span
                                                            title={totalAmt === 0 ? "Tiện ích buồng phòng miễn phí đã hoàn thành" : "Yêu cầu dịch vụ đã hoàn thành và được tự động hạch toán vào hóa đơn phòng"}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs select-none"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                            <span>{totalAmt === 0 ? 'Hoàn thành (Tiện ích miễn phí)' : 'Hoàn thành (Đã tính vào phòng)'}</span>
                                                        </span>
                                                    )}

                                                    {item.status === 'pending' && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                                                                <Clock className="w-3 h-3 text-amber-600 shrink-0" /> Chờ xử lý
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                                disabled={isUpdatingThis || needsCheckIn}
                                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 active:scale-95 ${
                                                                    needsCheckIn
                                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                                                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow-md'
                                                                }`}
                                                                title={
                                                                    getServiceLockReason(item) === 'NO_ROOM'
                                                                        ? "Chưa gán số phòng cụ thể. Cần liên hệ Lễ tân gán phòng trước khi thực hiện."
                                                                        : (getServiceLockReason(item) === 'WAIT_CHECKIN'
                                                                            ? "Khách chưa làm thủ tục Check-in nhận phòng. Dịch vụ ăn uống / spa yêu cầu khách có mặt tại phòng để phục vụ."
                                                                            : "Bắt đầu chuẩn bị")
                                                                }
                                                            >
                                                                {needsCheckIn ? <Lock className="w-3 h-3" /> : null}
                                                                <span>Bắt đầu</span>
                                                                <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, 'cancelled')}
                                                                disabled={isUpdatingThis}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition cursor-pointer"
                                                                title="Hủy yêu cầu này"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {item.status === 'in_progress' && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                                                                <ChefHat className="w-3 h-3 text-blue-600 shrink-0" /> Đang làm
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, 'delivering')}
                                                                disabled={isUpdatingThis}
                                                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs hover:shadow-md cursor-pointer flex items-center gap-1 active:scale-95"
                                                            >
                                                                <BellRing className="w-3 h-3 shrink-0" />
                                                                <span>Giao phòng</span>
                                                                <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, 'pending')}
                                                                disabled={isUpdatingThis}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                                                                title="Trả về Chờ xử lý"
                                                            >
                                                                <Undo2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {item.status === 'delivering' && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold">
                                                                <BellRing className="w-3 h-3 text-purple-600 shrink-0" /> Đang giao
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, 'completed')}
                                                                disabled={isUpdatingThis}
                                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs hover:shadow-md cursor-pointer flex items-center gap-1 active:scale-95"
                                                            >
                                                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                                                <span>Hoàn tất</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                                disabled={isUpdatingThis}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                                                                title="Trả về Đang chuẩn bị"
                                                            >
                                                                <Undo2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {item.status === 'cancelled' && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                                                <XCircle className="w-3 h-3 text-rose-600 shrink-0" /> Đã hủy
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, 'pending')}
                                                                disabled={isUpdatingThis}
                                                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                                            >
                                                                <RotateCcw className="w-3 h-3" />
                                                                <span>Khôi phục</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Nút In phiếu và Xem chi tiết (Rõ ràng, tinh tế, dễ bấm) */}
                                                    <div className="flex items-center gap-1.5 ml-2.5 pl-2.5 border-l border-slate-200">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePrintSlip(item)}
                                                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer border border-slate-200/70 active:scale-95"
                                                            title="In phiếu phục vụ phòng (Print Slip)"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedItemForDetail(item)}
                                                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 flex items-center justify-center transition cursor-pointer border border-blue-200/70 active:scale-95"
                                                            title="Xem chi tiết yêu cầu"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* DANH SÁCH THẺ TÁC NGHIỆP DI ĐỘNG (< md) - THUẬN TIỆN BẤM NÚT 1 CHẠM KHÔNG CẦN KÉO NGANG */}
                    <div className="block md:hidden bg-slate-50/70 p-3 space-y-3">
                        {isLoading && allListItems.length === 0 && (
                            <div className="py-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                <span className="text-xs">Đang tải danh sách yêu cầu dịch vụ...</span>
                            </div>
                        )}

                        {!isLoading && listItems.length === 0 && (
                            <div className="py-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-5">
                                <div className="text-3xl mb-2">📭</div>
                                <p className="font-semibold text-slate-700 text-xs">Không có yêu cầu dịch vụ nào</p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    {searchKeyword ? 'Hãy thử tìm kiếm với từ khóa khác.' : 'Chưa có yêu cầu nào trong mục này.'}
                                </p>
                            </div>
                        )}

                        {paginatedListItems.map((item) => {
                            const meta = STATUS_META[item.status];
                            const isUpdatingThis = isUpdatingId === item.id;
                            const totalAmt = Number(item.total_price) || 0;
                            const needsCheckIn = checkRequiresCheckIn(item);
                            const sla = getSlaStatus(item);
                            const lockReason = getServiceLockReason(item);

                            return (
                                <div
                                    key={item.id}
                                    className={`bg-white rounded-2xl border p-3.5 shadow-xs transition duration-150 flex flex-col gap-2.5 relative ${
                                        sla ? sla.borderGlow : 'border-slate-200'
                                    } ${isUpdatingThis ? 'opacity-60 bg-slate-50 pointer-events-none' : ''}`}
                                >
                                    {/* 1. Header Thẻ: Số phòng, Mã đơn, Trạng thái */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 font-mono font-black text-xs shadow-2xs">
                                                <DoorClosed className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                <span>{item.room_number ? `Phòng ${item.room_number}` : 'Chờ xếp'}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-400 font-semibold">
                                                #{item.booking_code}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta?.pill || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                {renderIcon(meta?.icon, "w-3 h-3 shrink-0")}
                                                <span>{meta?.label}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. Dòng cảnh báo (SLA hoặc Điều kiện phục vụ) & Thời gian */}
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {sla && (
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${sla.pill}`}>
                                                    <Clock className="w-2.5 h-2.5 shrink-0" />
                                                    <span>{sla.label}</span>
                                                </span>
                                            )}
                                            {item.status === 'pending' && (
                                                <>
                                                    {lockReason === 'NO_ROOM' && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold" title="Chưa gán số phòng cụ thể">
                                                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Chưa gán phòng
                                                        </span>
                                                    )}
                                                    {lockReason === 'WAIT_CHECKIN' && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold" title="Dịch vụ ăn uống / spa yêu cầu khách nhận phòng trước khi phục vụ">
                                                            <Lock className="w-2.5 h-2.5 shrink-0" /> Chờ Check-in
                                                        </span>
                                                    )}
                                                    {!lockReason && isRoomPrepService(item.service_name, item.category_name) && item.booking_status !== 'checked_in' && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-bold" title="Đã có số phòng! Có thể setup buồng phòng trước">
                                                            <BedDouble className="w-2.5 h-2.5 shrink-0" /> Setup phòng
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <div className="text-slate-400 font-medium ml-auto flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span>{formatTimeAgo(item.created_at)}</span>
                                        </div>
                                    </div>

                                    {/* 3. Nội dung món ăn / Dịch vụ */}
                                    <div className="flex items-start gap-2.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                                        {item.service_image ? (
                                            <img
                                                src={item.service_image}
                                                alt={item.service_name}
                                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 border border-slate-200/80">
                                                <UtensilsCrossed className="w-6 h-6 text-slate-400" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                                                {item.service_name}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <span className="px-1.5 py-0.5 rounded-md bg-white text-slate-600 text-[10px] font-semibold border border-slate-200/80">
                                                    {item.category_name || 'Dịch vụ'}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px]">
                                                    x{item.quantity || 1} suất
                                                </span>
                                                <span className="font-black text-rose-600 text-xs">
                                                    {totalAmt.toLocaleString('vi-VN')} đ
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-600">
                                                <span>Khách: <strong className="text-slate-800">{item.guest_name || 'Khách lưu trú'}</strong></span>
                                                <span>•</span>
                                                {totalAmt === 0 ? (
                                                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                                        <Gift className="w-2.5 h-2.5" /> Tiện ích miễn phí
                                                    </span>
                                                ) : item.is_paid ? (
                                                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Đã trả trước
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                                                        <CreditCard className="w-2.5 h-2.5" /> Thu Check-out
                                                    </span>
                                                )}
                                            </div>

                                            {item.is_scheduled && item.request_time && item.status !== 'completed' && item.status !== 'cancelled' && (
                                                <div className="mt-1 text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                                                    <Clock className="w-2.5 h-2.5 text-indigo-600" />
                                                    <span>Hẹn giờ: {new Date(item.request_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}

                                            {item.note && (
                                                <div className="mt-1.5 text-[11px] bg-amber-50/90 text-amber-900 border border-amber-200/60 p-2 rounded-lg font-medium flex items-start gap-1">
                                                    <MessageSquare className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                                                    <span className="italic">{item.note}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. Khung Thao Tác (Action Buttons to, rõ, dễ bấm bằng ngón cái) */}
                                    <div className="pt-0.5">
                                        {item.status === 'completed' && (
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span>Hoàn thành (Cộng hóa đơn phòng)</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrintSlip(item)}
                                                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer"
                                                        title="In phiếu"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedItemForDetail(item)}
                                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold cursor-pointer"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {item.status === 'pending' && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                    disabled={isUpdatingThis || needsCheckIn}
                                                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition shadow-sm flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer ${
                                                        needsCheckIn
                                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20'
                                                    }`}
                                                    title={
                                                        lockReason === 'NO_ROOM'
                                                            ? "Chưa gán số phòng cụ thể. Cần liên hệ Lễ tân gán phòng trước khi thực hiện."
                                                            : (lockReason === 'WAIT_CHECKIN'
                                                                ? "Khách chưa làm thủ tục Check-in nhận phòng. Dịch vụ ăn uống / spa yêu cầu khách có mặt tại phòng để phục vụ."
                                                                : "Bắt đầu chuẩn bị")
                                                    }
                                                >
                                                    {needsCheckIn ? <Lock className="w-3.5 h-3.5" /> : null}
                                                    <span>Bắt đầu làm</span>
                                                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintSlip(item)}
                                                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                                                    title="In phiếu phục vụ"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedItemForDetail(item)}
                                                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-xl text-xs font-bold transition cursor-pointer"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(item.id, 'cancelled')}
                                                    disabled={isUpdatingThis}
                                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition cursor-pointer"
                                                    title="Hủy đơn"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {item.status === 'in_progress' && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(item.id, 'delivering')}
                                                    disabled={isUpdatingThis}
                                                    className="flex-1 py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black transition shadow-sm shadow-purple-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                                                >
                                                    <BellRing className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Giao phòng</span>
                                                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(item.id, 'pending')}
                                                    disabled={isUpdatingThis}
                                                    className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                                    title="Trả về Chờ xử lý"
                                                >
                                                    <Undo2 className="w-3 h-3" />
                                                    <span>Lùi</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintSlip(item)}
                                                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                                                    title="In phiếu phục vụ"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedItemForDetail(item)}
                                                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-xl text-xs font-bold transition cursor-pointer"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {item.status === 'delivering' && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(item.id, 'completed')}
                                                    disabled={isUpdatingThis}
                                                    className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-black transition shadow-sm shadow-emerald-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Hoàn tất phục vụ</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                    disabled={isUpdatingThis}
                                                    className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                                    title="Trả về Đang chuẩn bị"
                                                >
                                                    <Undo2 className="w-3 h-3" />
                                                    <span>Lùi</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedItemForDetail(item)}
                                                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-xl text-xs font-bold transition cursor-pointer"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {item.status === 'cancelled' && (
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                                    <XCircle className="w-3 h-3 text-rose-600 shrink-0" /> Đã hủy
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(item.id, 'pending')}
                                                    disabled={isUpdatingThis}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    <span>Khôi phục</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* PHÂN TRANG */}
                    {listItems.length > LIST_PAGE_SIZE && (
                        <nav
                            aria-label="Phân trang yêu cầu dịch vụ"
                            className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3"
                        >
                            <p className="text-xs text-slate-500">
                                Hiển thị{' '}
                                <strong className="text-slate-800">
                                    {pageStartIndex + 1}–{Math.min(pageStartIndex + LIST_PAGE_SIZE, listItems.length)}
                                </strong>{' '}
                                trong tổng số <strong className="text-slate-800">{listItems.length}</strong> yêu cầu
                            </p>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleListPageChange(safePage - 1)}
                                    disabled={safePage === 1}
                                    aria-label="Trang trước"
                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center justify-center transition cursor-pointer hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                                >
                                    ‹
                                </button>
                                {listPageNumbers.map((p) =>
                                    typeof p === 'string' ? (
                                        <span key={p} className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs select-none">
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handleListPageChange(p)}
                                            aria-current={p === safePage ? 'page' : undefined}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                                p === safePage
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleListPageChange(safePage + 1)}
                                    disabled={safePage === listTotalPages}
                                    aria-label="Trang sau"
                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center justify-center transition cursor-pointer hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                                >
                                    ›
                                </button>
                            </div>
                        </nav>
                    )}
                </div>
            )}

            {/* BẢNG KANBAN BOARD 4 CỘT (DRAG AND DROP) */}
            {viewMode === 'board' && (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                {columns.map((col) => {
                    const columnItems = filterColumnItems(kanbanData[col.key] || []);
                    const isDropTarget = activeDropZone === col.key;
                    const isCompletedCol = col.key === 'completed';
                    const displayedItems = isCompletedCol ? columnItems.slice(0, completedDisplayCount) : columnItems;

                    return (
                        <div
                            key={col.key}
                            onDragOver={(e) => handleDragOver(e, col.key)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.key)}
                            className={`bg-slate-100/70 rounded-3xl border ${
                                col.borderColor
                            } p-4 flex flex-col min-h-[580px] transition-all duration-200 ${
                                isDropTarget ? col.dropHighlight : ''
                            }`}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-200/80">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{renderIcon(col.icon, "w-4 h-4")}</span>
                                    <h3 className="font-bold text-xs text-slate-900 tracking-wide uppercase">
                                        {col.title}
                                    </h3>
                                </div>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-xs ${col.badgeBg}`}
                                    title={isCompletedCol && columnItems.length > completedDisplayCount ? `Đang hiển thị ${displayedItems.length} trên tổng ${columnItems.length} đơn hoàn thành` : undefined}
                                >
                                    {isCompletedCol && columnItems.length > completedDisplayCount
                                        ? `${displayedItems.length} / ${columnItems.length}`
                                        : columnItems.length}
                                </span>
                            </div>

                            {/* Cards Container */}
                            <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[750px] pr-1 scrollbar-thin">
                                {displayedItems.length === 0 ? (
                                    <div className="h-44 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
                                        <span className="text-2xl mb-1">📭</span>
                                        <span>Không có yêu cầu nào</span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                            Kéo thả thẻ vào đây để đổi trạng thái
                                        </span>
                                    </div>
                                ) : (
                                    displayedItems.map((item) => {
                                        const isDraggingThis = draggedItemId === item.id;
                                        const isUpdatingThis = isUpdatingId === item.id;
                                        const totalAmt = Number(item.total_price) || 0;
                                        const isCompleted = item.status === 'completed' || col.key === 'completed';
                                        const needsCheckIn = checkRequiresCheckIn(item);
                                        const sla = getSlaStatus(item);

                                        return (
                                            <div
                                                key={item.id}
                                                draggable={!isCompleted}
                                                onDragStart={(e) => handleDragStart(e, item)}
                                                onDragEnd={handleDragEnd}
                                                className={`bg-white rounded-2xl border ${sla ? sla.borderGlow : 'border-slate-200/90'} p-4 shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                                                    isCompleted
                                                        ? 'cursor-default ring-1 ring-emerald-100/80 bg-emerald-50/20'
                                                        : 'cursor-grab active:cursor-grabbing hover:shadow-md'
                                                } ${col.accentHover} ${isDraggingThis ? 'opacity-40 scale-95 border-blue-400' : ''}`}
                                            >
                                                {/* Loading overlay when updating */}
                                                {isUpdatingThis && (
                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-10">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                            <span>Đang lưu...</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    {/* Card Header: Số phòng & Hạng phòng */}
                                                    <div className="flex items-start justify-between gap-2 pb-2 mb-2.5 border-b border-slate-100">
                                                        <div>
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono font-bold text-xs tracking-wider">
                                                                <DoorClosed className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                                <span>Phòng {item.room_number || 'Chờ xếp'}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 block mt-1 font-medium">
                                                                #{item.booking_code} • {item.guest_name}
                                                            </span>
                                                            {sla && (
                                                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold border mt-1 shadow-2xs ${sla.pill}`}>
                                                                    <Clock className="w-2.5 h-2.5 shrink-0" />
                                                                    <span>{sla.label}</span>
                                                                </div>
                                                            )}
                                                            {item.status === 'pending' && (
                                                                <>
                                                                    {getServiceLockReason(item) === 'NO_ROOM' && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold mt-1" title="Chưa gán số phòng cụ thể">
                                                                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Chưa gán phòng
                                                                        </span>
                                                                    )}
                                                                    {getServiceLockReason(item) === 'WAIT_CHECKIN' && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold mt-1" title="Dịch vụ ăn uống / spa yêu cầu khách nhận phòng trước khi phục vụ">
                                                                            <Lock className="w-2.5 h-2.5 shrink-0" /> Chờ Check-in
                                                                        </span>
                                                                    )}
                                                                    {!getServiceLockReason(item) && isRoomPrepService(item.service_name, item.category_name) && item.booking_status !== 'checked_in' && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-bold mt-1" title="Đã có số phòng! Nhân viên buồng phòng có thể chuẩn bị gối khăn / tiện nghi vào phòng trước khi khách tới">
                                                                            <BedDouble className="w-2.5 h-2.5 shrink-0" /> Setup phòng
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Badge nhóm dịch vụ & Trạng thái thanh toán */}
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                                {item.category_name || 'Dịch vụ'}
                                                            </span>
                                                            {totalAmt === 0 ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold whitespace-nowrap shadow-2xs" title="Tiện ích buồng phòng miễn phí">
                                                                    <Gift className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                                                    <span>Tiện ích miễn phí</span>
                                                                </span>
                                                            ) : item.is_paid ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold whitespace-nowrap shadow-2xs" title="Khách đã thanh toán trước khi đặt phòng">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    <span>Đã trả trước</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold whitespace-nowrap shadow-2xs" title="Dịch vụ phát sinh thu khi check-out">
                                                                    <CreditCard className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                                                    <span>Thu lúc Check-out</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Card Body: Tên dịch vụ & Số lượng */}
                                                    <div className="flex items-start gap-3 my-2">
                                                        {item.service_image ? (
                                                            <img
                                                                src={item.service_image}
                                                                alt={item.service_name}
                                                                className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 border border-slate-200/60">
                                                                <UtensilsCrossed className="w-6 h-6 text-slate-400" />
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                                                                {item.service_name}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-mono">
                                                                    x{item.quantity} suất
                                                                </span>
                                                                <span className="text-xs font-black text-rose-600">
                                                                    {totalAmt.toLocaleString('vi-VN')} đ
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Thời gian hẹn phục vụ cụ thể (chỉ hiển thị khi lễ tân có hẹn giờ và đơn chưa hoàn thành) */}
                                                    {item.is_scheduled && item.request_time && item.status !== 'completed' && item.status !== 'cancelled' && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold my-2 shadow-2xs">
                                                            <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                                                            <span>Hẹn phục vụ: {new Date(item.request_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    )}

                                                    {/* Ghi chú riêng của khách (nếu có) */}
                                                    {item.note && (
                                                        <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 my-2 flex items-start gap-1.5">
                                                            <MessageSquare className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                                                            <span className="font-medium italic leading-relaxed">
                                                                "{item.note}"
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Cảnh báo dịch vụ yêu cầu nhận phòng trước khi thực hiện */}
                                                    {needsCheckIn && item.status === 'pending' && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/90 text-amber-900 border border-amber-200 text-[10px] font-bold my-2 shadow-2xs">
                                                            <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                                                            <span>Khách chưa nhận phòng (Chờ Check-in)</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Card Footer: Thời gian & Nút bấm chuyển trạng thái */}
                                                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span>{formatTimeAgo(item.created_at)}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrintSlip(item);
                                                            }}
                                                            className="w-6 h-6 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
                                                            title="In phiếu phục vụ phòng (Print Slip)"
                                                        >
                                                            <Printer className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedItemForDetail(item);
                                                            }}
                                                            className="w-6 h-6 rounded-lg text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition cursor-pointer"
                                                            title="Xem chi tiết yêu cầu"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                        </button>
                                                    </div>

                                                    {/* CÁC NÚT BẤM CHUYỂN NHANH THEO CỘT */}
                                                    <div className="flex items-center gap-1.5">
                                                        {col.key === 'pending' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'cancelled')}
                                                                    title="Hủy yêu cầu này"
                                                                    className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <X className="w-2.5 h-2.5" />
                                                                    <span>Hủy</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                                    disabled={needsCheckIn}
                                                                    title={
                                                                        getServiceLockReason(item) === 'NO_ROOM'
                                                                            ? "Chưa gán số phòng cụ thể. Cần liên hệ Lễ tân gán phòng trước khi thực hiện."
                                                                            : (getServiceLockReason(item) === 'WAIT_CHECKIN'
                                                                                ? "Khách chưa làm thủ tục Check-in nhận phòng. Dịch vụ ăn uống / spa yêu cầu khách có mặt tại phòng để phục vụ."
                                                                                : "Bắt đầu chuẩn bị")
                                                                    }
                                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shadow-xs flex items-center gap-1 ${
                                                                        needsCheckIn
                                                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                                                            : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                                                    }`}
                                                                >
                                                                    {needsCheckIn && <Lock className="w-2.5 h-2.5" />}
                                                                    <span>Bắt đầu</span>
                                                                    <ArrowRight className="w-2.5 h-2.5" />
                                                                </button>
                                                            </>
                                                        )}

                                                        {col.key === 'in_progress' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'pending')}
                                                                    title="Trả về Chờ xử lý"
                                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <Undo2 className="w-2.5 h-2.5" />
                                                                    <span>Chờ</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'delivering')}
                                                                    title="Bắt đầu phục vụ / mang lên phòng / đón khách"
                                                                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <BellRing className="w-2.5 h-2.5" />
                                                                    <span>Phục vụ</span>
                                                                    <ArrowRight className="w-2.5 h-2.5" />
                                                                </button>
                                                            </>
                                                        )}

                                                        {col.key === 'delivering' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                                    title="Trả về Đang chuẩn bị"
                                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <Undo2 className="w-2.5 h-2.5" />
                                                                    <span>Chuẩn bị</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'completed')}
                                                                    title="Đã phục vụ hoàn thành cho khách hàng"
                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                                    <span>Hoàn thành</span>
                                                                </button>
                                                            </>
                                                        )}

                                                        {col.key === 'completed' && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span
                                                                    title="Đã tính vào hóa đơn phòng, không thể thay đổi trạng thái"
                                                                    className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1 select-none"
                                                                >
                                                                    <Lock className="w-2.5 h-2.5" />
                                                                    <span>Đã tính hóa đơn</span>
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}

                                {/* NÚT XEM THÊM & THU GỌN CHO CỘT HOÀN THÀNH (PHƯƠNG ÁN 1) */}
                                {isCompletedCol && columnItems.length > 8 && (
                                    <div className="pt-2.5 pb-1 space-y-1.5 border-t border-slate-200/80 mt-2">
                                        {columnItems.length > completedDisplayCount ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setCompletedDisplayCount((prev) => prev + 8)}
                                                    className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
                                                >
                                                    <span>▾ Xem thêm 8 đơn cũ hơn</span>
                                                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                                                        Còn {columnItems.length - displayedItems.length}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setCompletedDisplayCount(columnItems.length)}
                                                    className="w-full text-center text-[11px] text-slate-500 hover:text-emerald-700 hover:underline font-semibold cursor-pointer py-0.5"
                                                >
                                                    Xem tất cả ({columnItems.length} đơn)
                                                </button>
                                            </>
                                        ) : (
                                            <div className="text-center pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setCompletedDisplayCount(8)}
                                                    className="py-1.5 px-3 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <span>▴ Thu gọn lại 8 đơn mới nhất</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* DANH SÁCH YÊU CẦU ĐÃ HỦY (EXPANDABLE) */}
            {showCancelled && (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-rose-500" />
                            <h3 className="font-bold text-sm text-slate-900">
                                Danh Sách Yêu Cầu Dịch Vụ Đã Hủy ({kanbanData.cancelled?.length || 0})
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCancelled(false)}
                            className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                        >
                            Thu gọn ▲
                        </button>
                    </div>

                    {kanbanData.cancelled?.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">Chưa có yêu cầu nào bị hủy.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {kanbanData.cancelled?.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 opacity-75"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800">
                                            Phòng {item.room_number || 'Chờ xếp'} (#{item.booking_code})
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                                            Đã hủy
                                        </span>
                                    </div>
                                    <div className="font-semibold text-slate-700">
                                        {item.service_name} (x{item.quantity})
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px] text-slate-400">
                                        <span>{formatTimeAgo(item.created_at)}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus(item.id, 'pending')}
                                            className="text-blue-600 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                                        >
                                            <Undo2 className="w-3 h-3" />
                                            <span>Khôi phục</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            </>
            )}

            {/* ========================================================= */}
            {/* MODAL CHI TIẾT ĐƠN DỊCH VỤ (DETAIL INSPECTION)            */}
            {/* ========================================================= */}
            {selectedItemForDetail && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setSelectedItemForDetail(null)}
                >
                    <div
                        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                    <BellRing className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-900 text-base">
                                            Yêu Cầu Phục Vụ #{selectedItemForDetail.id}
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                                            Phòng {selectedItemForDetail.room_number || 'Chờ xếp'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Đơn đặt #{selectedItemForDetail.booking_code} • Khách: {selectedItemForDetail.guest_name || 'Khách lưu trú'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedItemForDetail(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-4 text-xs">
                            {/* SLA Overdue Banner if applicable */}
                            {(() => {
                                const sla = getSlaStatus(selectedItemForDetail);
                                if (!sla) return null;
                                return (
                                    <div className={`p-3 rounded-2xl border flex items-center gap-2.5 ${sla.pill}`}>
                                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                        <div>
                                            <strong className="font-bold">Cảnh báo SLA:</strong> {sla.label} — Yêu cầu đang vượt thời gian tiêu chuẩn phục vụ phòng.
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Service Item Summary Card */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                            {selectedItemForDetail.category_name || 'Dịch vụ'}
                                        </span>
                                        <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                                            {selectedItemForDetail.service_name}
                                        </h4>
                                    </div>
                                    <span
                                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                                            STATUS_META[selectedItemForDetail.status]?.pill || 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {renderIcon(STATUS_META[selectedItemForDetail.status]?.icon, "w-3.5 h-3.5")}
                                        <span>{STATUS_META[selectedItemForDetail.status]?.label || selectedItemForDetail.status}</span>
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/60 text-center">
                                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 block">Số lượng</span>
                                        <strong className="text-xs text-slate-800 font-bold">x{selectedItemForDetail.quantity || 1}</strong>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 block">Đơn giá</span>
                                        <strong className="text-xs text-slate-800 font-bold">
                                            {Number(selectedItemForDetail.unit_price || 0).toLocaleString('vi-VN')} đ
                                        </strong>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 block">Thành tiền</span>
                                        <strong className="text-xs text-rose-600 font-bold">
                                            {Number(selectedItemForDetail.total_price || 0).toLocaleString('vi-VN')} đ
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* Payment & Room Status */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Trạng thái thanh toán</span>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${selectedItemForDetail.is_paid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                        <strong className={`text-xs ${selectedItemForDetail.is_paid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {selectedItemForDetail.is_paid ? 'Đã thanh toán' : 'Chưa thu (Tính vào phòng)'}
                                        </strong>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Thời gian gửi yêu cầu</span>
                                    <strong className="text-xs text-slate-800 mt-1 block">
                                        {formatTimeAgo(selectedItemForDetail.created_at)}
                                    </strong>
                                </div>
                            </div>

                            {/* Guest Special Request Note */}
                            <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/70">
                                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] mb-1">
                                    <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Ghi chú của khách hàng</span>
                                </div>
                                <p className="text-xs text-amber-900 italic">
                                    {selectedItemForDetail.note ? `"${selectedItemForDetail.note}"` : 'Không có ghi chú đặc biệt.'}
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                            <button
                                type="button"
                                onClick={() => handlePrintSlip(selectedItemForDetail)}
                                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="In phiếu phục vụ phòng cho bộ phận bếp / chạy món"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>In Phiếu Order</span>
                            </button>

                            <div className="flex items-center gap-2">
                                {selectedItemForDetail.status === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleUpdateStatus(selectedItemForDetail.id, 'in_progress');
                                            setSelectedItemForDetail((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
                                        }}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                                    >
                                        <span>Bắt đầu làm</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {selectedItemForDetail.status === 'in_progress' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleUpdateStatus(selectedItemForDetail.id, 'delivering');
                                            setSelectedItemForDetail((prev) => (prev ? { ...prev, status: 'delivering' } : null));
                                        }}
                                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                                    >
                                        <BellRing className="w-3.5 h-3.5" />
                                        <span>Giao phòng</span>
                                    </button>
                                )}
                                {selectedItemForDetail.status === 'delivering' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleUpdateStatus(selectedItemForDetail.id, 'completed');
                                            setSelectedItemForDetail(null);
                                        }}
                                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Hoàn tất</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectedItemForDetail(null)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL TẠO YÊU CẦU DỊCH VỤ / ĐẶT MÓN TẠI PHÒNG (ROOM SERVICE) */}
            {/* ========================================================= */}
            {isCreateModalOpen && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => !modalSubmitting && setIsCreateModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 via-white to-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                                    <UtensilsCrossed className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">
                                        Tiếp Nhận Đặt Món / Dịch Vụ Tại Phòng
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Ghi nhận nhanh món ăn, thức uống hoặc tiện ích khách gọi qua điện thoại bàn
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={modalSubmitting}
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleCreateServiceRequest} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
                                {modalError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span>{modalError}</span>
                                    </div>
                                )}

                                {isLoadingModalData ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                                        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang tải danh sách phòng và thực đơn dịch vụ...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Bước 1: Chọn phòng đang lưu trú */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-800">
                                                1. Phòng lưu trú của khách <span className="text-rose-500">*</span>
                                            </label>
                                            {activeBookings.length === 0 ? (
                                                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
                                                    Không có phòng nào đang trong trạng thái lưu trú (Checked-in). Vui lòng kiểm tra lại sơ đồ buồng phòng.
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <select
                                                        value={selectedBookingId}
                                                        onChange={(e) => setSelectedBookingId(e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        required
                                                    >
                                                        <option value="" disabled>-- Chọn phòng của khách đang lưu trú --</option>
                                                        {activeBookings.map((b) => (
                                                            <option key={b.id} value={b.id}>
                                                                Phòng {b.room_number || 'Chưa gán'} • {b.guest_name} (#{b.booking_code})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bước 2: Chọn Món ăn / Dịch vụ */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-bold text-slate-800">
                                                    2. Món ăn / Dịch vụ yêu cầu <span className="text-rose-500">*</span>
                                                </label>
                                                <span className="text-[11px] text-slate-400">
                                                    ({filteredModalServices.length} món khả dụng)
                                                </span>
                                            </div>

                                            {/* Bộ lọc Danh mục & Ô tìm kiếm nhanh */}
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        value={modalServiceSearch}
                                                        onChange={(e) => setModalServiceSearch(e.target.value)}
                                                        placeholder="Tìm tên món ăn, đồ uống, dịch vụ..."
                                                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>

                                                <select
                                                    value={modalCategoryFilter}
                                                    onChange={(e) => setModalCategoryFilter(e.target.value)}
                                                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="all">Tất cả danh mục</option>
                                                    {modalServiceCategories.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Danh sách các món (Click chọn trực quan) */}
                                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50/50 space-y-1.5">
                                                {filteredModalServices.length === 0 ? (
                                                    <p className="text-center py-6 text-slate-400 text-xs">
                                                        Không tìm thấy món ăn hoặc dịch vụ nào phù hợp.
                                                    </p>
                                                ) : (
                                                    filteredModalServices.map((srv) => {
                                                        const isSelected = String(selectedServiceId) === String(srv.id);
                                                        return (
                                                            <div
                                                                key={srv.id}
                                                                onClick={() => setSelectedServiceId(String(srv.id))}
                                                                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                                                                    isSelected
                                                                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400 shadow-2xs'
                                                                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                                                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                                                    }`}>
                                                                        {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <UtensilsCrossed className="w-3.5 h-3.5 text-slate-500" />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                                                            <span>{srv.name}</span>
                                                                            <span className="text-[10px] text-slate-400 font-normal">
                                                                                ({srv.category_name || srv.category?.name || 'Khác'})
                                                                            </span>
                                                                        </div>
                                                                        {srv.description && (
                                                                            <p className="text-[10px] text-slate-400 line-clamp-1 max-w-sm">
                                                                                {srv.description}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <strong className="text-xs font-bold text-blue-600">
                                                                    {Number(srv.price || 0).toLocaleString('vi-VN')} đ
                                                                </strong>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* Bước 3: Số lượng & Ghi chú */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-800">
                                                    3. Số lượng suất / phần
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setOrderQuantity(Math.max(1, Number(orderQuantity) - 1))}
                                                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer transition"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="99"
                                                        value={orderQuantity}
                                                        onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="w-16 text-center py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setOrderQuantity(Number(orderQuantity) + 1)}
                                                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer transition"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tổng tiền tạm tính */}
                                            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex flex-col justify-center">
                                                <span className="text-[10px] text-blue-700 uppercase font-bold">Thành tiền tạm tính</span>
                                                <strong className="text-base font-black text-blue-900 mt-0.5">
                                                    {Number((modalSelectedService?.price || 0) * (orderQuantity || 1)).toLocaleString('vi-VN')} đ
                                                </strong>
                                                <span className="text-[10px] text-blue-500 mt-0.5">
                                                    * Tự động cộng vào hóa đơn phòng khi hoàn tất
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bước 4: Ghi chú đặc biệt của khách */}
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-slate-800">
                                                4. Yêu cầu đặc biệt của khách (Ghi chú bếp / phục vụ)
                                            </label>
                                            <textarea
                                                rows="2"
                                                value={orderNote}
                                                onChange={(e) => setOrderNote(e.target.value)}
                                                placeholder="VD: Không cay, ít đường, mang thêm 2 bộ ly thìa, để trước cửa phòng bấm chuông..."
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            ></textarea>

                                            {/* Quick suggestion tags */}
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[10px] text-slate-400 font-semibold">Gợi ý nhanh:</span>
                                                {[
                                                    'Không cay',
                                                    'Ít ngọt / Không đá',
                                                    'Giao nóng ngay khi xong',
                                                    'Thêm 2 bộ chén đĩa',
                                                    'Để trước cửa & bấm chuông'
                                                ].map((tag) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => {
                                                            setOrderNote((prev) => (prev ? `${prev}, ${tag}` : tag));
                                                        }}
                                                        className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold transition cursor-pointer"
                                                    >
                                                        + {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer Submit */}
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    disabled={modalSubmitting}
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalSubmitting || isLoadingModalData || !selectedBookingId || !selectedServiceId}
                                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {modalSubmitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang tạo đơn...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Xác Nhận Tạo Đơn Phục Vụ</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
