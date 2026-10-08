import React, { useState, useEffect, useMemo } from 'react';
import {
    Tag,
    Plus,
    Search,
    Edit2,
    Trash2,
    RefreshCw,
    X,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Percent,
    DollarSign,
    Check,
    Clock,
    Copy,
    Sparkles
} from 'lucide-react';
import { promotionService } from '../../services/promotionService';

export default function PromotionManagement() {
    // 1. STATE DỮ LIỆU
    const [promotions, setPromotions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'expired'

    // 2. STATE MODAL THÊM MỚI / CHỈNH SỬA
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [editingItem, setEditingItem] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);

    // Form data state
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        discount_type: 'percentage', // 'percentage' | 'fixed'
        discount_value: '',
        valid_from: '',
        valid_to: '',
        usage_limit: 100,
        min_order_value: 0,
        max_discount_amount: '',
        is_active: true
    });

    // 3. STATE MODAL XÁC NHẬN XÓA
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        item: null,
        isDeleting: false
    });

    // 4. STATE TOAST THÔNG BÁO
    const [toast, setToast] = useState(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    // 5. GỌI API LẤY DANH SÁCH KHUYẾN MÃI (GET)
    const fetchPromotions = async () => {
        setIsLoading(true);
        try {
            const res = await promotionService.getPromotions();
            if (res.success) {
                setPromotions(res.data || []);
            } else {
                showToast('error', res.message);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách khuyến mãi:', error);
            showToast('error', 'Lỗi kết nối máy chủ khi lấy danh sách khuyến mãi.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    // 6. KIỂM TRA TRẠNG THÁI (ĐANG DIỄN RA / HẾT HẠN)
    const getPromoStatus = (promo) => {
        const now = new Date();
        const validTo = promo.valid_to ? new Date(promo.valid_to) : null;
        const validFrom = promo.valid_from ? new Date(promo.valid_from) : null;

        if (!promo.is_active) {
            return {
                type: 'inactive',
                label: 'Đã tạm dừng',
                color: 'bg-slate-100 text-slate-700 border-slate-200'
            };
        }

        if (validTo && validTo < now) {
            return {
                type: 'expired',
                label: 'Hết hạn',
                color: 'bg-rose-50 text-rose-700 border-rose-200'
            };
        }

        if (validFrom && validFrom > now) {
            return {
                type: 'upcoming',
                label: 'Sắp diễn ra',
                color: 'bg-amber-50 text-amber-700 border-amber-200'
            };
        }

        if (promo.used_count >= promo.usage_limit) {
            return {
                type: 'depleted',
                label: 'Hết lượt dùng',
                color: 'bg-rose-50 text-rose-700 border-rose-200'
            };
        }

        return {
            type: 'active',
            label: 'Đang diễn ra',
            color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
    };

    // 7. LỌC VÀ TÌM KIẾM DỮ LIỆU
    const filteredPromotions = useMemo(() => {
        return promotions.filter((item) => {
            const query = searchTerm.toLowerCase().trim();
            const matchesSearch =
                !query ||
                (item.code && item.code.toLowerCase().includes(query)) ||
                (item.name && item.name.toLowerCase().includes(query)) ||
                (item.id && String(item.id).includes(query));

            if (!matchesSearch) return false;

            const status = getPromoStatus(item);
            if (filterStatus === 'active') return status.type === 'active';
            if (filterStatus === 'expired') return status.type === 'expired' || status.type === 'depleted';
            return true;
        });
    }, [promotions, searchTerm, filterStatus]);

    // Format ngày giờ hiển thị DD/MM/YYYY
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    // Helper format datetime cho input datetime-local: YYYY-MM-DDTHH:mm
    const toInputDatetime = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch {
            return '';
        }
    };

    // Copy mã voucher
    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    // 8. MỞ MODAL THÊM MỚI
    const handleOpenCreateModal = () => {
        setModalMode('create');
        setEditingItem(null);

        // Mặc định: Bắt đầu từ hôm nay, kết thúc sau 30 ngày
        const now = new Date();
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);

        setFormData({
            code: '',
            name: '',
            discount_type: 'percentage',
            discount_value: '',
            valid_from: toInputDatetime(now.toISOString()),
            valid_to: toInputDatetime(nextMonth.toISOString()),
            usage_limit: 100,
            min_order_value: 0,
            max_discount_amount: '',
            is_active: true
        });
        setIsModalOpen(true);
    };

    // 9. MỞ MODAL CẬP NHẬT
    const handleOpenEditModal = (item) => {
        setModalMode('edit');
        setEditingItem(item);
        setFormData({
            code: item.code || '',
            name: item.name || '',
            discount_type: item.discount_type || 'percentage',
            discount_value: item.discount_value !== undefined ? String(item.discount_value) : '',
            valid_from: toInputDatetime(item.valid_from),
            valid_to: toInputDatetime(item.valid_to),
            usage_limit: item.usage_limit || 100,
            min_order_value: item.min_order_value || 0,
            max_discount_amount: item.max_discount_amount ? String(item.max_discount_amount) : '',
            is_active: item.is_active !== undefined ? item.is_active : true
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setEditingItem(null);
    };

    // 10. SUBMIT FORM (POST THÊM MỚI HOẶC PUT CẬP NHẬT)
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        const codeTrimmed = formData.code.trim().toUpperCase();
        if (!codeTrimmed) {
            showToast('error', 'Vui lòng nhập mã Voucher khuyến mãi.');
            return;
        }

        if (!formData.discount_value || Number(formData.discount_value) <= 0) {
            showToast('error', 'Vui lòng nhập mức giảm hợp lệ lớn hơn 0.');
            return;
        }

        if (formData.discount_type === 'percentage' && Number(formData.discount_value) > 100) {
            showToast('error', 'Mức giảm phần trăm không được vượt quá 100%.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                code: codeTrimmed,
                name: formData.name.trim() || `Khuyến mãi ${codeTrimmed}`,
                discount_type: formData.discount_type,
                discount_value: Number(formData.discount_value),
                valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : new Date().toISOString(),
                valid_to: formData.valid_to
                    ? new Date(formData.valid_to).toISOString()
                    : new Date(Date.now() + 30 * 86400000).toISOString(),
                usage_limit: Number(formData.usage_limit) || 100,
                min_order_value: Number(formData.min_order_value) || 0,
                max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
                is_active: Boolean(formData.is_active)
            };

            if (modalMode === 'create') {
                const res = await promotionService.createPromotion(payload);
                if (res.success) {
                    showToast('success', res.message || 'Tạo voucher khuyến mãi thành công!');
                    setIsModalOpen(false);
                    fetchPromotions();
                } else {
                    showToast('error', res.message);
                }
            } else if (modalMode === 'edit' && editingItem) {
                const res = await promotionService.updatePromotion(editingItem.id, payload);
                if (res.success) {
                    showToast('success', res.message || 'Cập nhật voucher khuyến mãi thành công!');
                    setIsModalOpen(false);
                    fetchPromotions();
                } else {
                    showToast('error', res.message);
                }
            }
        } catch (error) {
            console.error('Lỗi khi lưu voucher:', error);
            showToast('error', 'Đã xảy ra lỗi khi lưu voucher khuyến mãi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 11. XÓA VOUCHER (DELETE)
    const handleOpenDeleteModal = (item) => {
        setDeleteModal({
            isOpen: true,
            item,
            isDeleting: false
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.item) return;
        setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
        try {
            const res = await promotionService.deletePromotion(deleteModal.item.id);
            if (res.success) {
                showToast('success', `Đã xóa voucher "${deleteModal.item.code}" thành công!`);
                setDeleteModal({ isOpen: false, item: null, isDeleting: false });
                fetchPromotions();
            } else {
                showToast('error', res.message);
                setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
            }
        } catch (error) {
            console.error('Lỗi khi xóa voucher:', error);
            showToast('error', 'Lỗi kết nối khi xóa voucher khuyến mãi.');
            setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-12">
            {/* TOAST THÔNG BÁO NỔI */}
            {toast && (
                <div
                    className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-slideInRight ${toast.type === 'success'
                        ? 'bg-emerald-500/95 text-white border-emerald-400 shadow-emerald-500/20'
                        : 'bg-rose-500/95 text-white border-rose-400 shadow-rose-500/20'
                        }`}
                >
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 shrink-0" />
                    )}
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button
                        type="button"
                        onClick={() => setToast(null)}
                        className="ml-2 hover:opacity-75 transition cursor-pointer text-white/80"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* HEADER: TIÊU ĐỀ "QUẢN LÝ KHUYẾN MÃI" VÀ NÚT "+ THÊM VOUCHER" */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                                Quản Lý Khuyến Mãi
                            </h1>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                {promotions.length} vouchers
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Quản lý các chương trình ưu đãi, mã giảm giá booking phòng và sự kiện
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Nút Làm mới */}
                    <button
                        type="button"
                        onClick={fetchPromotions}
                        disabled={isLoading}
                        className="p-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>

                    {/* Nút "+ Thêm Voucher" ở góc phải */}
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Thêm Voucher</span>
                    </button>
                </div>
            </div>

            {/* THANH TÌM KIẾM & BỘ LỌC */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm kiếm theo mã CODE, tên chương trình hoặc ID..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 rounded-lg transition ${filterStatus === 'all' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                }`}
                        >
                            Tất cả ({promotions.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('active')}
                            className={`px-3 py-1.5 rounded-lg transition ${filterStatus === 'active' ? 'bg-white text-emerald-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                }`}
                        >
                            Đang diễn ra
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('expired')}
                            className={`px-3 py-1.5 rounded-lg transition ${filterStatus === 'expired' ? 'bg-white text-rose-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                }`}
                        >
                            Hết hạn
                        </button>
                    </div>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU (TABLE): ID, MÃ CODE, TÊN CHƯƠNG TRÌNH, MỨC GIẢM, TRẠNG THÁI, HÀNH ĐỘNG */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-6 w-20 text-center">ID</th>
                                <th className="py-4 px-6 min-w-[160px]">Mã Code</th>
                                <th className="py-4 px-6 min-w-[240px]">Tên chương trình</th>
                                <th className="py-4 px-6 min-w-[160px]">Mức giảm</th>
                                <th className="py-4 px-6 min-w-[180px]">Thời gian áp dụng</th>
                                <th className="py-4 px-6 w-36 text-center">Trạng thái</th>
                                <th className="py-4 px-6 w-36 text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400">
                                        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                        <p className="font-semibold text-slate-600 text-sm">Đang tải danh sách khuyến mãi...</p>
                                    </td>
                                </tr>
                            ) : filteredPromotions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
                                            🏷️
                                        </div>
                                        <p className="font-semibold text-slate-700 text-sm">Không tìm thấy mã khuyến mãi nào</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {searchTerm
                                                ? 'Thử tìm kiếm với từ khóa khác'
                                                : 'Chưa có voucher nào được tạo. Bấm "+ Thêm Voucher" để bắt đầu!'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPromotions.map((item) => {
                                    const status = getPromoStatus(item);
                                    const isPercentage = item.discount_type === 'percentage';

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                                            {/* CỘT 1: ID */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                                    #{item.id}
                                                </span>
                                            </td>

                                            {/* CỘT 2: MÃ CODE (Ví dụ: SUMMER2026) */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-sm text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-lg tracking-wider">
                                                        {item.code}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyCode(item.code)}
                                                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                                        title="Copy mã voucher"
                                                    >
                                                        {copiedCode === item.code ? (
                                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* CỘT 3: TÊN CHƯƠNG TRÌNH */}
                                            <td className="py-4 px-6">
                                                <strong className="text-slate-900 font-bold block text-sm group-hover:text-blue-600 transition-colors">
                                                    {item.name || `Khuyến mãi ${item.code}`}
                                                </strong>
                                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                                    <span>Đã dùng: <strong>{item.used_count || 0}</strong>/{item.usage_limit || 100}</span>
                                                    {item.min_order_value > 0 && (
                                                        <span>• Đơn tối thiểu: <strong>{Number(item.min_order_value).toLocaleString('vi-VN')} đ</strong></span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* CỘT 4: MỨC GIẢM (%, hoặc VNĐ) */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-base font-bold text-rose-600">
                                                        {isPercentage
                                                            ? `-${item.discount_value}%`
                                                            : `-${Number(item.discount_value).toLocaleString('vi-VN')} đ`}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-medium">
                                                        ({isPercentage ? 'Theo %' : 'Cố định'})
                                                    </span>
                                                </div>
                                                {isPercentage && item.max_discount_amount && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        Tối đa: {Number(item.max_discount_amount).toLocaleString('vi-VN')} đ
                                                    </div>
                                                )}
                                            </td>

                                            {/* CỘT: THỜI GIAN ÁP DỤNG */}
                                            <td className="py-4 px-6">
                                                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span>{formatDate(item.valid_from)} — {formatDate(item.valid_to)}</span>
                                                </div>
                                            </td>

                                            {/* CỘT 5: TRẠNG THÁI (Đang diễn ra / Hết hạn - Badge xanh / đỏ) */}
                                            <td className="py-4 px-6 text-center">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${status.type === 'active'
                                                            ? 'bg-emerald-500 animate-pulse'
                                                            : status.type === 'upcoming'
                                                                ? 'bg-amber-500'
                                                                : 'bg-rose-500'
                                                            }`}
                                                    />
                                                    {status.label}
                                                </span>
                                            </td>

                                            {/* CỘT 6: HÀNH ĐỘNG (NÚT SỬA, NÚT XÓA) */}
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* Nút Sửa */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(item)}
                                                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                        title="Chỉnh sửa voucher"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                                        <span>Sửa</span>
                                                    </button>

                                                    {/* Nút Xóa */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDeleteModal(item)}
                                                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                        title="Xóa voucher"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                                        <span>Xóa</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL FORM: THÊM MỚI HOẶC CẬP NHẬT VOUCHER KHUYẾN MÃI */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                    <div className="fixed inset-0" onClick={handleCloseModal} aria-hidden="true" />

                    <div
                        className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden z-10 animate-scaleUp max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg border border-rose-100 shadow-xs">
                                    <Tag className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        {modalMode === 'create' ? 'Thêm Voucher Khuyến Mãi Mới' : 'Cập Nhật Voucher Khuyến Mãi'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {modalMode === 'create'
                                            ? 'Tạo mã voucher giảm giá phòng nghỉ và dịch vụ'
                                            : `Chỉnh sửa voucher #${editingItem?.id} (${editingItem?.code})`}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseModal}
                                disabled={isSubmitting}
                                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body (Scrollable) */}
                        <form onSubmit={handleSubmitForm} className="overflow-y-auto p-6 space-y-4">
                            {/* 1. MÃ CODE & LOẠI GIẢM */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Mã Code Voucher <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        placeholder="Ví dụ: SUMMER2026"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold tracking-wider text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition uppercase"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Viết hoa, không dấu, liền nhau</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Loại Mức Giảm <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.discount_type}
                                        onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white"
                                    >
                                        <option value="percentage">Giảm theo % (Phần trăm)</option>
                                        <option value="fixed">Giảm số tiền cố định (VNĐ)</option>
                                    </select>
                                </div>
                            </div>

                            {/* 2. TÊN CHƯƠNG TRÌNH */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Tên Chương Trình Khuyến Mãi <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ví dụ: Khuyến Mãi Chào Hè Rực Rỡ 2026"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                />
                            </div>

                            {/* 3. MỨC GIẢM & GIỚI HẠN TỐI ĐA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Mức Giảm {formData.discount_type === 'percentage' ? '(%)' : '(VNĐ)'} <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            max={formData.discount_type === 'percentage' ? '100' : undefined}
                                            value={formData.discount_value}
                                            onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                                            placeholder={formData.discount_type === 'percentage' ? 'Ví dụ: 15' : 'Ví dụ: 200000'}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition pr-12"
                                        />
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                            {formData.discount_type === 'percentage' ? '%' : 'VNĐ'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        {formData.discount_type === 'percentage' ? 'Mức giảm tối đa (VNĐ)' : 'Số lượt tối đa'}
                                    </label>
                                    {formData.discount_type === 'percentage' ? (
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.max_discount_amount}
                                            onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                                            placeholder="Bỏ trống nếu không giới hạn"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                        />
                                    ) : (
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.usage_limit}
                                            onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                                            placeholder="100"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* 4. THỜI GIAN ÁP DỤNG */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Ngày Bắt Đầu
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.valid_from}
                                        onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Ngày Hết Hạn
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.valid_to}
                                        onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                    />
                                </div>
                            </div>

                            {/* 5. ĐIỀU KIỆN ĐƠN TỐI THIỂU & TRẠNG THÁI KÍCH HOẠT */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Đơn Tối Thiểu (VNĐ)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.min_order_value}
                                        onChange={(e) => setFormData({ ...formData, min_order_value: e.target.value })}
                                        placeholder="0 (Không yêu cầu)"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                    />
                                </div>

                                <div className="pt-5">
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 border-slate-300"
                                        />
                                        <span className="text-xs font-bold text-slate-700">
                                            Kích hoạt voucher ngay lập tức
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* FOOTER NÚT LƯU */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{modalMode === 'create' ? 'Tạo Voucher' : 'Lưu Thay Đổi'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN XÓA */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                    <div
                        className="fixed inset-0"
                        onClick={() => !deleteModal.isDeleting && setDeleteModal({ isOpen: false, item: null, isDeleting: false })}
                    />
                    <div
                        className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-center z-10 animate-scaleUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-2xl mx-auto mb-4">
                            <Trash2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                            Xác nhận xóa Voucher?
                        </h3>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                            Bạn có chắc chắn muốn xóa voucher{' '}
                            <strong className="text-slate-900 font-mono font-bold">
                                "{deleteModal.item?.code}"
                            </strong>{' '}
                            - {deleteModal.item?.name}? Thao tác này không thể hoàn tác.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                disabled={deleteModal.isDeleting}
                                onClick={() => setDeleteModal({ isOpen: false, item: null, isDeleting: false })}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={deleteModal.isDeleting}
                                onClick={handleConfirmDelete}
                                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {deleteModal.isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>Xác nhận Xóa</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
