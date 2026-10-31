import React, { useState, useEffect, useCallback } from 'react';
import {
    Package,
    Archive,
    PhoneCall,
    CheckCircle2,
    Target,
    Search,
    X,
    Plus,
    Trash2,
    Handshake,
    AlertTriangle,
    Loader2,
    MapPin,
    UserCheck,
    Phone,
    Maximize2,
    Sparkles,
    Smartphone,
    FileText,
    Shirt,
    Glasses,
    Luggage,
    Clock,
    FileCheck,
    PackageSearch
} from 'lucide-react';
import roomService from '../../services/roomService';
import ReportLostItemModal from '../../components/admin/modals/shared/ReportLostItemModal';
import { useHasPermission } from '../../utils/permission';
import { useAuth } from '../../store/authStore';

export default function LostAndFoundManagement() {
    const { user } = useAuth();
    const isManagerOrAdmin = Boolean(user?.is_superuser || ['admin', 'owner', 'manager'].includes(user?.role));
    const canDelete = useHasPermission('rooms', 'delete') || isManagerOrAdmin;

    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        stored: 0,
        contacted: 0,
        returned: 0,
        disposed: 0,
        return_rate: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(6);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedItemForReturn, setSelectedItemForReturn] = useState(null);
    const [returnModalData, setReturnModalData] = useState({
        returned_to: '',
        return_note: '',
        isSubmitting: false,
        error: ''
    });
    const [previewImage, setPreviewImage] = useState(null);
    const [alertMessage, setAlertMessage] = useState(null);

    // Delete Modal
    const [deletingItem, setDeletingItem] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (categoryFilter !== 'all') params.category = categoryFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const [itemsRes, statsRes] = await Promise.all([
                roomService.getLostAndFoundItems(params),
                roomService.getLostAndFoundStats()
            ]);

            if (itemsRes.success) {
                setItems(itemsRes.data);
            }
            if (statsRes.success) {
                setStats(statsRes);
            }
        } catch (error) {
            console.error('Error fetching lost & found items:', error);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, categoryFilter, searchTerm]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 300);
        return () => clearTimeout(timer);
    }, [loadData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, categoryFilter, searchTerm]);

    const handleOpenReturnModal = (item) => {
        setSelectedItemForReturn(item);
        setReturnModalData({
            returned_to: item.guest_name ? `${item.guest_name} (${item.guest_phone || 'Khách lưu trú'})` : '',
            return_note: '',
            isSubmitting: false,
            error: ''
        });
    };

    const handleConfirmReturn = async (e) => {
        e.preventDefault();
        if (!returnModalData.returned_to.trim()) {
            setReturnModalData((prev) => ({ ...prev, error: 'Vui lòng nhập thông tin người nhận lại đồ.' }));
            return;
        }

        setReturnModalData((prev) => ({ ...prev, isSubmitting: true, error: '' }));
        try {
            const res = await roomService.returnLostAndFoundItem(selectedItemForReturn.id, {
                returned_to: returnModalData.returned_to.trim(),
                return_note: returnModalData.return_note.trim()
            });

            if (res && res.success) {
                setAlertMessage({
                    type: 'success',
                    text: `Đã bàn giao trao trả món đồ #${selectedItemForReturn.tracking_code} thành công!`
                });
                setSelectedItemForReturn(null);
                loadData();
                setTimeout(() => setAlertMessage(null), 3500);
            } else {
                setReturnModalData((prev) => ({
                    ...prev,
                    isSubmitting: false,
                    error: res?.message || 'Bàn giao thất bại.'
                }));
            }
        } catch (error) {
            setReturnModalData((prev) => ({
                ...prev,
                isSubmitting: false,
                error: 'Đã có lỗi xảy ra khi thực hiện bàn giao.'
            }));
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingItem || !canDelete) return;
        setIsDeleting(true);
        try {
            const res = await roomService.deleteLostAndFoundItem(deletingItem.id);
            if (res && res.success) {
                setAlertMessage({
                    type: 'success',
                    text: `Đã xóa vĩnh viễn phiếu đồ thất lạc #${deletingItem.tracking_code} (${deletingItem.item_name}) thành công!`
                });
                setDeletingItem(null);
                loadData();
                setTimeout(() => setAlertMessage(null), 3500);
            } else {
                setAlertMessage({
                    type: 'error',
                    text: res?.message || 'Xóa phiếu đồ thất lạc thất bại.'
                });
                setTimeout(() => setAlertMessage(null), 3500);
            }
        } catch {
            setAlertMessage({
                type: 'error',
                text: 'Đã có lỗi xảy ra khi xóa phiếu đồ thất lạc.'
            });
            setTimeout(() => setAlertMessage(null), 3500);
        } finally {
            setIsDeleting(false);
        }
    };

    const statusConfig = {
        stored: {
            label: 'Đang lưu kho',
            badge: 'bg-amber-50 text-amber-700 border-amber-200',
            dot: 'bg-amber-500'
        },
        contacted: {
            label: 'Đã liên hệ khách',
            badge: 'bg-blue-50 text-blue-700 border-blue-200',
            dot: 'bg-blue-500'
        },
        returned: {
            label: 'Đã trao trả khách',
            badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            dot: 'bg-emerald-500'
        },
        disposed: {
            label: 'Đã thanh lý / Hủy',
            badge: 'bg-slate-100 text-slate-600 border-slate-200',
            dot: 'bg-slate-400'
        }
    };

    const categoryConfig = {
        electronics: {
            label: 'Thiết bị điện tử',
            icon: Smartphone,
            bg: 'bg-blue-50 text-blue-600 border-blue-100'
        },
        valuable: {
            label: 'Đồ giá trị / Trang sức',
            icon: Sparkles,
            bg: 'bg-amber-50 text-amber-600 border-amber-100'
        },
        documents: {
            label: 'Giấy tờ / Ví tiền',
            icon: FileText,
            bg: 'bg-indigo-50 text-indigo-600 border-indigo-100'
        },
        clothing: {
            label: 'Quần áo / Giày dép',
            icon: Shirt,
            bg: 'bg-violet-50 text-violet-600 border-violet-100'
        },
        accessories: {
            label: 'Phụ kiện / Mỹ phẩm',
            icon: Glasses,
            bg: 'bg-pink-50 text-pink-600 border-pink-100'
        },
        other: {
            label: 'Khác',
            icon: Package,
            bg: 'bg-slate-50 text-slate-600 border-slate-200'
        }
    };

    const formatDateTime = (dtStr) => {
        if (!dtStr) return '-';
        const d = new Date(dtStr);
        return d.toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = items.slice(startIndex, endIndex);

    return (
        <div className="space-y-6 animate-fadeIn pb-12">
            {/* Alert Floating */}
            {alertMessage && (
                <div
                    className={`p-4 border rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-lg ${
                        alertMessage.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {alertMessage.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{alertMessage.text}</span>
                    </div>
                    <button
                        onClick={() => setAlertMessage(null)}
                        className={`p-1 rounded-lg hover:bg-black/5 transition cursor-pointer ${
                            alertMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <PackageSearch className="w-6 h-6 text-purple-600" />
                        <span>Quản Lý Đồ Thất Lạc (Lost & Found)</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Tiếp nhận, lưu kho bảo quản và trao trả tài sản khách bỏ quên tại phòng hoặc khu vực khách sạn
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>Báo Đồ Thất Lạc Mới</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between hover:border-slate-300 transition">
                    <div>
                        <div className="text-xs text-slate-500 font-medium">Tổng tiếp nhận</div>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200/60 shadow-2xs">
                        <Package className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-2xs flex items-center justify-between hover:border-amber-300 transition">
                    <div>
                        <div className="text-xs text-amber-700 font-medium">Đang lưu kho</div>
                        <div className="text-xl sm:text-2xl font-bold text-amber-900 mt-1">{stats.stored}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200/60 shadow-2xs">
                        <Archive className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 shadow-2xs flex items-center justify-between hover:border-blue-300 transition">
                    <div>
                        <div className="text-xs text-blue-700 font-medium">Đã liên hệ khách</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-900 mt-1">{stats.contacted}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200/60 shadow-2xs">
                        <PhoneCall className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition">
                    <div>
                        <div className="text-xs text-emerald-700 font-medium">Đã trao trả</div>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-900 mt-1">{stats.returned}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 shadow-2xs flex items-center justify-between col-span-2 lg:col-span-1 hover:border-purple-300 transition">
                    <div>
                        <div className="text-xs text-purple-700 font-medium">Tỷ lệ trao trả</div>
                        <div className="text-xl sm:text-2xl font-bold text-purple-900 mt-1">{stats.return_rate}%</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200/60 shadow-2xs">
                        <Target className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                            <Search className="w-4 h-4" />
                        </span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm theo mã phiếu, tên đồ, số phòng, tên khách, số điện thoại..."
                            className="w-full pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        >
                            <option value="all">Tất cả phân loại</option>
                            <option value="electronics">Thiết bị điện tử</option>
                            <option value="valuable">Đồ giá trị / Trang sức</option>
                            <option value="documents">Giấy tờ / Ví tiền</option>
                            <option value="clothing">Quần áo / Giày dép</option>
                            <option value="accessories">Phụ kiện / Mỹ phẩm</option>
                            <option value="other">Khác</option>
                        </select>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                    {[
                        { key: 'all', label: 'Tất cả', count: stats.total },
                        { key: 'stored', label: 'Đang lưu kho', count: stats.stored },
                        { key: 'contacted', label: 'Đã liên hệ', count: stats.contacted },
                        { key: 'returned', label: 'Đã trao trả', count: stats.returned },
                        { key: 'disposed', label: 'Đã thanh lý', count: stats.disposed }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStatusFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                statusFilter === tab.key
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                statusFilter === tab.key ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Items Grid / List */}
            {isLoading ? (
                <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <span>Đang tải danh sách đồ thất lạc...</span>
                </div>
            ) : items.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3 border border-purple-100 shadow-2xs">
                        <Luggage className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">Không có đồ thất lạc nào</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Không tìm thấy tài sản nào phù hợp với bộ lọc hiện tại. Bấm "Báo Đồ Thất Lạc Mới" nếu bạn vừa nhặt được đồ khách để quên.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedItems.map((item) => {
                        const statusObj = statusConfig[item.status] || statusConfig.stored;
                        const catObj = categoryConfig[item.category] || categoryConfig.other;
                        const CategoryIcon = catObj.icon;
                        const isReturned = item.status === 'returned';

                        return (
                            <div
                                key={item.id}
                                className={`rounded-2xl border bg-white shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden ${
                                    isReturned ? 'border-slate-200' : 'border-purple-200 ring-1 ring-purple-100/60'
                                }`}
                            >
                                {/* Card Header */}
                                <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${catObj.bg}`}>
                                            <CategoryIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                                    #{item.tracking_code}
                                                </span>
                                                {item.room_number && (
                                                    <span className="text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                        P.{item.room_number}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-900 truncate mt-0.5" title={item.item_name}>
                                                {item.item_name}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 shrink-0 ${statusObj.badge}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusObj.dot}`}></span>
                                        <span>{statusObj.label}</span>
                                    </span>
                                </div>

                                {/* Card Body */}
                                <div className="p-4 flex-1 space-y-2.5 text-xs text-slate-600">
                                    {/* Image Thumbnail if available */}
                                    {item.image_url && (
                                        <div
                                            onClick={() => setPreviewImage(item.image_url)}
                                            className="relative h-36 rounded-xl overflow-hidden border border-slate-200 group cursor-pointer bg-slate-100"
                                        >
                                            <img
                                                src={item.image_url}
                                                alt={item.item_name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                            />
                                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-2xs">
                                                <Maximize2 className="w-4 h-4" />
                                                <span>Xem ảnh phóng to</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Vị trí tìm thấy */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Vị trí nhặt:</span>
                                        </span>
                                        <strong className="text-slate-800 text-right truncate">
                                            {item.location_found}
                                        </strong>
                                    </div>

                                    {/* Nơi cất giữ */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                                            <Archive className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Nơi lưu kho:</span>
                                        </span>
                                        <span className="font-semibold text-slate-800 text-right truncate">
                                            {item.storage_location}
                                        </span>
                                    </div>

                                    {/* Người tìm thấy & Thời gian */}
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                                        <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Người nhặt:</span>
                                        </span>
                                        <span className="font-medium text-slate-700 truncate">
                                            {item.finder_name || 'Nhân viên buồng'} ({formatDateTime(item.found_date)})
                                        </span>
                                    </div>

                                    {/* Khách hàng liên quan */}
                                    {(item.guest_name || item.guest_phone) && (
                                        <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 text-purple-950 space-y-1">
                                            <div className="font-bold flex items-center justify-between text-xs">
                                                <span>Khách: {item.guest_name || 'Khách lưu trú'}</span>
                                                {item.guest_phone && (
                                                    <a
                                                        href={`tel:${item.guest_phone}`}
                                                        className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-950 font-semibold text-[11px] hover:underline"
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        {item.guest_phone}
                                                    </a>
                                                )}
                                            </div>
                                            {item.booking && (
                                                <div className="text-[10px] text-purple-700/80 font-mono">
                                                    Đơn phòng liên quan: #{item.booking}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Description */}
                                    {item.description && (
                                        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl italic border border-slate-100">
                                            "{item.description}"
                                        </div>
                                    )}

                                    {/* Return Details if already returned */}
                                    {isReturned && (
                                        <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-[11px] space-y-1">
                                            <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                                                <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>Đã bàn giao cho: {item.returned_to}</span>
                                            </div>
                                            <div className="text-[10px] text-emerald-700 flex items-center gap-1">
                                                <Clock className="w-3 h-3 shrink-0" />
                                                <span>Xử lý bởi: {item.handled_by_name || 'Lễ tân'} ({formatDateTime(item.returned_date)})</span>
                                            </div>
                                            {item.return_note && (
                                                <div className="text-[10px] text-emerald-600 italic bg-white/70 p-1.5 rounded-lg border border-emerald-100">
                                                    Ghi chú: {item.return_note}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer Actions */}
                                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                                    {!isReturned ? (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenReturnModal(item)}
                                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <Handshake className="w-3.5 h-3.5" />
                                            <span>Bàn Giao Trả Khách</span>
                                        </button>
                                    ) : (
                                        <div className="flex-1 py-1.5 px-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200/60 flex items-center justify-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Đã hoàn tất trao trả</span>
                                        </div>
                                    )}

                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={() => setDeletingItem(item)}
                                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer font-bold text-xs flex items-center justify-center gap-1 shrink-0"
                                            title="Xóa vĩnh viễn phiếu đồ thất lạc (Chỉ Quản lý/Admin)"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalItems > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>
                            Hiển thị <strong className="text-slate-800">{startIndex + 1} - {endIndex}</strong> trên tổng <strong className="text-slate-800">{totalItems}</strong> đồ thất lạc
                        </span>
                        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                            <span className="text-slate-400">Hiển thị:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                            >
                                <option value={6}>6 món / trang</option>
                                <option value={9}>9 món / trang</option>
                                <option value={12}>12 món / trang</option>
                                <option value={24}>24 món / trang</option>
                            </select>
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                                    currentPage === 1
                                        ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 cursor-pointer'
                                }`}
                            >
                                ← Trước
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                .reduce((acc, p, idx, arr) => {
                                    if (idx > 0 && p - arr[idx - 1] > 1) {
                                        acc.push('...');
                                    }
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400 text-xs">
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setCurrentPage(p)}
                                            className={`min-w-8 h-8 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                                currentPage === p
                                                    ? 'bg-purple-600 text-white shadow-xs'
                                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}

                            <button
                                type="button"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                                    currentPage === totalPages
                                        ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 cursor-pointer'
                                }`}
                            >
                                Sau →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal 1: Báo đồ thất lạc mới */}
            <ReportLostItemModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(res) => {
                    setAlertMessage({
                        type: 'success',
                        text: res.message || 'Đã ghi nhận đồ thất lạc mới thành công!'
                    });
                    loadData();
                    setTimeout(() => setAlertMessage(null), 3500);
                }}
            />

            {/* Modal 2: Bàn giao trả khách */}
            {selectedItemForReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-3.5 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-2xs">
                                    <Handshake className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900">Xác Nhận Bàn Giao Trả Khách</h3>
                                    <p className="text-[11px] text-slate-500">Ghi nhận thông tin người nhận đồ thất lạc</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedItemForReturn(null)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmReturn} className="p-5 space-y-3.5 text-xs">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                <div className="font-bold text-slate-800 text-sm">
                                    {selectedItemForReturn.item_name}
                                </div>
                                <div className="text-slate-500 font-mono text-[11px]">
                                    Mã phiếu: #{selectedItemForReturn.tracking_code} | Vị trí: {selectedItemForReturn.location_found}
                                </div>
                            </div>

                            {returnModalData.error && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{returnModalData.error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Người nhận lại (Họ tên & SĐT / CCCD) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={returnModalData.returned_to}
                                    onChange={(e) =>
                                        setReturnModalData((prev) => ({ ...prev, returned_to: e.target.value }))
                                    }
                                    placeholder="VD: Anh Nguyễn Văn A - 0901234567 (CCCD: 00120000xxxx)"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Ghi chú biên bản bàn giao
                                </label>
                                <textarea
                                    rows={2}
                                    value={returnModalData.return_note}
                                    onChange={(e) =>
                                        setReturnModalData((prev) => ({ ...prev, return_note: e.target.value }))
                                    }
                                    placeholder="Khách đã kiểm tra đầy đủ tài sản nguyên vẹn, đã ký biên bản bàn giao tại quầy Lễ tân..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedItemForReturn(null)}
                                    disabled={returnModalData.isSubmitting}
                                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="submit"
                                    disabled={returnModalData.isSubmitting}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {returnModalData.isSubmitting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Xác nhận đã trả khách</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 3: Xác nhận xóa phiếu đồ thất lạc (Chỉ Quản lý/Admin) */}
            {deletingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">
                                Xác Nhận Xóa Phiếu Đồ Thất Lạc?
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                                Hành động này sẽ xóa vĩnh viễn phiếu <strong className="text-slate-800">#{deletingItem.tracking_code} - {deletingItem.item_name}</strong> khỏi hệ thống.
                            </p>
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] text-left mb-5 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Lưu ý:</strong> Thao tác này chỉ dành cho Quản trị viên hoặc Quản lý để loại bỏ các phiếu lập sai hoặc kiểm thử.
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeletingItem(null)}
                                    disabled={isDeleting}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Hủy Bỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>Xác Nhận Xóa</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Preview Image */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black">
                        <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
