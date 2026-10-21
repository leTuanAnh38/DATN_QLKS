import React, { useState, useEffect, useMemo, useCallback } from 'react';
import roomService from '../../services/roomService';
import { useHasPermission } from '../../utils/permission';
import { useAuth } from '../../store/authStore';

export default function MinibarManagement() {
    const { user } = useAuth();
    const isSuperOrManager = Boolean(user?.is_superuser || ['admin', 'owner', 'manager'].includes(user?.role));
    const canCreate = useHasPermission('categories', 'create') || isSuperOrManager;
    const canUpdate = useHasPermission('categories', 'update') || isSuperOrManager;
    const canDelete = useHasPermission('categories', 'delete') || isSuperOrManager;

    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);

    // Modal Add / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'drink',
        price: '',
        standard_quantity: 2,
        image_url: '',
        is_active: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Modal Delete
    const [deletingItem, setDeletingItem] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Toast Alert
    const [alertMessage, setAlertMessage] = useState(null);

    const loadItems = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await roomService.getMinibarItems();
            if (res.success && Array.isArray(res.data)) {
                setItems(res.data);
            }
        } catch (error) {
            console.error('Error loading minibar items:', error);
            showAlert('error', 'Không thể tải danh sách mặt hàng Minibar.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const showAlert = (type, text) => {
        setAlertMessage({ type, text });
        setTimeout(() => setAlertMessage(null), 3500);
    };

    const categories = [
        { key: 'drink', label: 'Nước ngọt & Nước khoáng', icon: '🥤', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
        { key: 'alcohol', label: 'Bia & Rượu vang', icon: '🍺', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
        { key: 'snack', label: 'Đồ ăn vặt & Bánh kẹo', icon: '🍿', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { key: 'other', label: 'Đồ tiện ích & Khác', icon: '📦', badge: 'bg-purple-50 text-purple-700 border-purple-200' }
    ];

    const getCategoryObj = (catKey) => {
        return categories.find((c) => c.key === catKey) || {
            label: catKey || 'Khác',
            icon: '📦',
            badge: 'bg-slate-50 text-slate-700 border-slate-200'
        };
    };

    const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' ₫';

    // Statistics
    const stats = useMemo(() => {
        const total = items.length;
        const active = items.filter((it) => it.is_active).length;
        const inactive = total - active;
        const avgPrice = total > 0 ? items.reduce((acc, it) => acc + Number(it.price || 0), 0) / total : 0;
        return { total, active, inactive, avgPrice };
    }, [items]);

    // Filtered items
    const filteredItems = useMemo(() => {
        return items.filter((it) => {
            const matchSearch = searchTerm.trim() === '' || it.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat = categoryFilter === 'all' || it.category === categoryFilter;
            const matchStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && it.is_active) ||
                (statusFilter === 'inactive' && !it.is_active);
            return matchSearch && matchCat && matchStatus;
        });
    }, [items, searchTerm, categoryFilter, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter, statusFilter]);

    const totalItems = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = useMemo(() => {
        return filteredItems.slice(startIndex, endIndex);
    }, [filteredItems, startIndex, endIndex]);

    // Handle Open Create Modal
    const handleOpenCreate = () => {
        if (!canCreate) {
            showAlert('error', 'Bạn không có quyền thêm mới mặt hàng Minibar.');
            return;
        }
        setEditingItem(null);
        setFormData({
            name: '',
            category: 'drink',
            price: '',
            standard_quantity: 2,
            image_url: '',
            is_active: true
        });
        setFormError('');
        setIsModalOpen(true);
    };

    // Handle Open Edit Modal
    const handleOpenEdit = (item) => {
        if (!canUpdate) {
            showAlert('error', 'Bạn không có quyền chỉnh sửa mặt hàng Minibar.');
            return;
        }
        setEditingItem(item);
        setFormData({
            name: item.name || '',
            category: item.category || 'drink',
            price: item.price || '',
            standard_quantity: item.standard_quantity || 2,
            image_url: item.image_url || '',
            is_active: Boolean(item.is_active)
        });
        setFormError('');
        setIsModalOpen(true);
    };

    // Quick toggle active status
    const handleToggleActive = async (item) => {
        if (!canUpdate) {
            showAlert('error', 'Bạn không có quyền thay đổi trạng thái bán.');
            return;
        }
        const nextState = !item.is_active;
        try {
            // Optimistic update
            setItems((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, is_active: nextState } : it))
            );
            const res = await roomService.updateMinibarItem(item.id, { is_active: nextState });
            if (!res.success) {
                // Revert on failure
                setItems((prev) =>
                    prev.map((it) => (it.id === item.id ? { ...it, is_active: item.is_active } : it))
                );
                showAlert('error', res.message || 'Cập nhật trạng thái thất bại.');
            } else {
                showAlert('success', `Đã ${nextState ? 'kích hoạt' : 'tạm ẩn'} món "${item.name}".`);
            }
        } catch {
            setItems((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, is_active: item.is_active } : it))
            );
            showAlert('error', 'Đã có lỗi xảy ra.');
        }
    };

    // Submit form (create or edit)
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.name.trim()) {
            setFormError('Vui lòng nhập tên mặt hàng.');
            return;
        }

        const priceNum = Number(formData.price);
        if (isNaN(priceNum) || priceNum <= 0) {
            setFormError('Vui lòng nhập đơn giá hợp lệ (> 0 VNĐ).');
            return;
        }

        const standardQty = parseInt(formData.standard_quantity, 10);
        if (isNaN(standardQty) || standardQty < 0) {
            setFormError('Định mức tiêu chuẩn trong phòng phải lớn hơn hoặc bằng 0.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name.trim(),
                category: formData.category,
                price: priceNum,
                standard_quantity: standardQty,
                image_url: formData.image_url.trim(),
                is_active: formData.is_active
            };

            let res;
            if (editingItem) {
                res = await roomService.updateMinibarItem(editingItem.id, payload);
            } else {
                res = await roomService.createMinibarItem(payload);
            }

            if (res && res.success) {
                showAlert('success', res.message || (editingItem ? 'Đã cập nhật món thành công!' : 'Đã thêm món mới thành công!'));
                setIsModalOpen(false);
                loadItems();
            } else {
                setFormError(res?.message || 'Không thể lưu mặt hàng.');
            }
        } catch {
            setFormError('Đã có lỗi xảy ra khi lưu mặt hàng.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!deletingItem || !canDelete) return;
        setIsDeleting(true);
        try {
            const res = await roomService.deleteMinibarItem(deletingItem.id);
            if (res && res.success) {
                showAlert('success', `Đã xóa món "${deletingItem.name}" thành công.`);
                setDeletingItem(null);
                loadItems();
            } else {
                showAlert('error', res?.message || 'Xóa món thất bại.');
            }
        } catch {
            showAlert('error', 'Đã có lỗi xảy ra khi xóa mặt hàng.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-12">
            {/* Alert Floating Toast */}
            {alertMessage && (
                <div className="fixed top-5 right-5 z-50 animate-slideDown">
                    <div
                        className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border text-xs sm:text-sm font-semibold ${
                            alertMessage.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                    >
                        <span>{alertMessage.type === 'success' ? '✓' : '⚠️'}</span>
                        <span>{alertMessage.text}</span>
                        <button
                            onClick={() => setAlertMessage(null)}
                            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                       
                        <span>Quản Lý Danh Mục Minibar & Bảng Giá</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Cấu hình bảng giá niêm yết, định mức tiêu chuẩn và kiểm soát trạng thái các món phục vụ trong tủ lạnh phòng
                    </p>
                </div>

                {canCreate ? (
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                        <span className="text-base font-bold">+</span>
                        <span>Thêm Món Minibar Mới</span>
                    </button>
                ) : (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 shrink-0">
                        <span>🔒</span>
                        <span>Chế độ xem bảng giá (Chỉ đọc)</span>
                    </div>
                )}
            </div>

            {/* 4 Stat KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Tổng số món */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng mặt hàng</span>
                        <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                            📦
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.total}</span>
                        <span className="text-xs text-slate-400">món</span>
                    </div>
                </div>

                {/* 2. Đang kinh doanh */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Đang bán</span>
                        <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                            ✓
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">{stats.active}</span>
                        <span className="text-xs text-emerald-600">món hiển thị</span>
                    </div>
                </div>

                {/* 3. Tạm ẩn / Ngừng bán */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tạm ẩn</span>
                        <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold">
                            ⏸
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-600">{stats.inactive}</span>
                        <span className="text-xs text-slate-400">món hết hàng</span>
                    </div>
                </div>

                {/* 4. Giá trung bình */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Giá trung bình</span>
                        <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold">
                            💰
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-extrabold text-amber-700">
                            {formatCurrency(Math.round(stats.avgPrice))}
                        </span>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm theo tên đồ uống, snack, rượu vang..."
                            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="all">Tất cả phân loại</option>
                            <option value="drink">🥤 Nước ngọt & Nước khoáng</option>
                            <option value="alcohol">🍺 Bia & Rượu</option>
                            <option value="snack">🍿 Đồ ăn vặt & Bánh kẹo</option>
                            <option value="other">📦 Đồ tiện ích & Khác</option>
                        </select>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
                    {[
                        { key: 'all', label: `Tất cả (${items.length})` },
                        { key: 'active', label: `Đang kinh doanh (${stats.active})` },
                        { key: 'inactive', label: `Đã tạm ẩn (${stats.inactive})` }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStatusFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                                statusFilter === tab.key
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Table / Grid List */}
            {isLoading ? (
                <div className="py-20 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Đang tải danh mục Minibar...
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3">
                        🍾
                    </div>
                    <h4 className="text-base font-bold text-slate-800">Không tìm thấy món Minibar nào</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Không có mặt hàng nào phù hợp với bộ lọc tìm kiếm hiện tại. Bấm "Thêm Món Minibar Mới" để tạo mặt hàng phục vụ phòng.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                                <tr>
                                    <th className="py-3.5 px-4">Mặt hàng</th>
                                    <th className="py-3.5 px-4">Phân loại</th>
                                    <th className="py-3.5 px-4 text-right">Đơn giá niêm yết</th>
                                    <th className="py-3.5 px-4 text-center">Định mức / phòng</th>
                                    <th className="py-3.5 px-4 text-center">Trạng thái bán</th>
                                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedItems.map((item) => {
                                    const cat = getCategoryObj(item.category);
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                                            {/* Name & Icon */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                                                        {cat.icon}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900">{item.name}</div>
                                                        <div className="text-[11px] text-slate-400">Mã món: #{item.id}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category Badge */}
                                            <td className="py-3.5 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cat.badge}`}>
                                                    <span>{cat.icon}</span>
                                                    <span>{cat.label}</span>
                                                </span>
                                            </td>

                                            {/* Price */}
                                            <td className="py-3.5 px-4 text-right">
                                                <span className="font-bold text-amber-700 text-sm">
                                                    {formatCurrency(item.price)}
                                                </span>
                                            </td>

                                            {/* Standard Quantity */}
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs">
                                                    {item.standard_quantity || 0}
                                                </span>
                                                <span className="text-[11px] text-slate-400 ml-1">đơn vị</span>
                                            </td>

                                            {/* Active Toggle Switch */}
                                            <td className="py-3.5 px-4 text-center">
                                                {canUpdate ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleActive(item)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                                                            item.is_active
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                                        }`}
                                                        title={item.is_active ? 'Bấm để tạm ẩn ngừng bán' : 'Bấm để kích hoạt bán'}
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                        <span>{item.is_active ? 'Đang bán' : 'Tạm ẩn'}</span>
                                                    </button>
                                                ) : (
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                            item.is_active
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                                : 'bg-slate-100 text-slate-500 border-slate-300'
                                                        }`}
                                                        title="Trạng thái mở bán"
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                        <span>{item.is_active ? 'Đang bán' : 'Tạm ẩn'}</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action Buttons */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {canUpdate && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(item)}
                                                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer font-semibold text-xs flex items-center gap-1"
                                                            title="Chỉnh sửa thông tin & giá"
                                                        >
                                                            <span>✏️</span>
                                                            
                                                        </button>
                                                    )}

                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingItem(item)}
                                                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer font-semibold text-xs flex items-center gap-1"
                                                            title="Xóa khỏi danh mục"
                                                        >
                                                            <span>🗑️</span>
                                                            
                                                        </button>
                                                    )}

                                                    {!canUpdate && !canDelete && (
                                                        <span className="text-xs text-slate-400 italic font-medium">Chỉ xem</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalItems > 0 && (
                        <div className="bg-slate-50/60 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-3 text-slate-500">
                                <span>
                                    Hiển thị <strong className="text-slate-800">{startIndex + 1} - {endIndex}</strong> trên tổng <strong className="text-slate-800">{totalItems}</strong> mặt hàng
                                </span>
                                <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                                    <span className="text-slate-400">Hiển thị:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                                    >
                                        <option value={6}>6 món / trang</option>
                                        <option value={8}>8 món / trang</option>
                                        <option value={12}>12 món / trang</option>
                                        <option value={20}>20 món / trang</option>
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
                                                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 cursor-pointer shadow-2xs'
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
                                                            ? 'bg-blue-600 text-white shadow-xs'
                                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
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
                                                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 cursor-pointer shadow-2xs'
                                        }`}
                                    >
                                        Sau →
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Thêm / Sửa Món Minibar */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
                    <div
                        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-xl shrink-0">
                                    {editingItem ? '✏️' : '🍾'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900">
                                        {editingItem ? 'Chỉnh Sửa Món Minibar' : 'Thêm Món Minibar Mới'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {editingItem ? `Cập nhật bảng giá & thông tin món #${editingItem.id}` : 'Điền thông tin và định mức chuẩn trang bị trong phòng'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmitForm} className="p-5 space-y-4 text-xs sm:text-sm">
                            {formError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Tên món */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Tên mặt hàng Minibar <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="VD: Bia Heineken Silver, Nước suối Evian, Snack Pringles..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                                />
                            </div>

                            {/* Phân loại & Đơn giá */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">
                                        Phân loại nhóm <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm cursor-pointer"
                                    >
                                        <option value="drink">🥤 Nước ngọt & Nước khoáng</option>
                                        <option value="alcohol">🍺 Bia & Rượu</option>
                                        <option value="snack">🍿 Đồ ăn vặt & Bánh kẹo</option>
                                        <option value="other">📦 Đồ tiện ích & Khác</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">
                                        Đơn giá niêm yết (VNĐ) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1000"
                                        step="1000"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        placeholder="VD: 35000"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-amber-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                                    />
                                    {formData.price && (
                                        <div className="text-[11px] text-amber-700 font-semibold mt-1">
                                            = {formatCurrency(formData.price)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Định mức chuẩn & Ảnh */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">
                                        Định mức chuẩn trong phòng
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={formData.standard_quantity}
                                        onChange={(e) => setFormData({ ...formData, standard_quantity: e.target.value })}
                                        placeholder="Mặc định: 2"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                                    />
                                    <span className="text-[11px] text-slate-400">Số lượng chuẩn cần có trong tủ lạnh</span>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">
                                        Trạng thái phục vụ
                                    </label>
                                    <div className="pt-2">
                                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="font-semibold text-slate-800 text-xs">
                                                Kích hoạt bán (Hiển thị cho Buồng phòng)
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting && <span className="animate-spin">⏳</span>}
                                    <span>{editingItem ? 'Lưu thay đổi' : 'Thêm vào danh mục'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Xác Nhận Xóa */}
            {deletingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto">
                            🗑️
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-base text-slate-900">Xóa món Minibar này?</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Bạn có chắc chắn muốn xóa <strong>"{deletingItem.name}"</strong>? Sau khi xóa, món này sẽ không còn xuất hiện trong danh mục kiểm kê.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setDeletingItem(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isDeleting && <span className="animate-spin">⏳</span>}
                                <span>Xác nhận Xóa</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
