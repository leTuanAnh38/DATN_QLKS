import React, { useState, useEffect, useMemo, useRef } from 'react';
import hotelService from '../../services/hotelService';

export default function ServiceManagement() {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    // Phân trang danh sách dịch vụ
    const [currentPage, setCurrentPage] = useState(1);

    // State cho Modal Thêm / Sửa
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Form data
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price: '',
        description: '',
        is_active: true,
        image_url: '',
    });

    // Image upload handling
    const [imageType, setImageType] = useState('url'); // 'file' | 'url'
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState('');
    const fileInputRef = useRef(null);

    // State cho Modal Thêm Nhóm Danh Mục
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCatData, setNewCatData] = useState({ name: '', icon: '🍽️', description: '' });
    const [submittingCat, setSubmittingCat] = useState(false);

    // State cho Modal Xóa
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [serviceToDelete, setServiceToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Toast alert state
    const [toast, setToast] = useState(null);
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    // Tải dữ liệu toàn bộ Dịch vụ và Nhóm danh mục
    const loadAllData = async () => {
        setIsLoading(true);
        try {
            const [catRes, itemsRes] = await Promise.all([
                hotelService.getServiceCategories(),
                hotelService.getAllServiceItems({ status: 'all' })
            ]);

            if (catRes.success) setCategories(catRes.categories || []);
            if (itemsRes.success) setServices(itemsRes.items || []);
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu dịch vụ:', error);
            showToast('error', 'Không thể kết nối máy chủ để tải danh sách dịch vụ.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();

        // Lắng nghe sự kiện thay đổi danh mục từ tab khác
        const handleCatalogChanged = () => loadAllData();
        const handleStorage = (e) => {
            if (e.key === 'pms_service_catalog_changed') loadAllData();
        };

        window.addEventListener('pms_service_catalog_changed', handleCatalogChanged);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('pms_service_catalog_changed', handleCatalogChanged);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // Thống kê nhanh
    const stats = useMemo(() => {
        const total = services.length;
        const active = services.filter((s) => s.is_active).length;
        const inactive = total - active;
        const catCount = categories.length;
        return { total, active, inactive, catCount };
    }, [services, categories]);

    // Lọc danh sách dịch vụ
    const filteredServices = useMemo(() => {
        return services.filter((s) => {
            const matchCategory =
                selectedCategory === 'all' || String(s.category_id) === String(selectedCategory);
            const matchStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && s.is_active) ||
                (statusFilter === 'inactive' && !s.is_active);
            const matchSearch =
                !searchQuery.trim() ||
                s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.category_name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCategory && matchStatus && matchSearch;
        });
    }, [services, selectedCategory, statusFilter, searchQuery]);

    // Phân trang: Grid 8 thẻ/trang, Table 10 dòng/trang
    const itemsPerPage = viewMode === 'grid' ? 8 : 10;
    const totalPages = Math.max(1, Math.ceil(filteredServices.length / itemsPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const pageStartIndex = (safePage - 1) * itemsPerPage;
    const paginatedServices = useMemo(
        () => filteredServices.slice(pageStartIndex, pageStartIndex + itemsPerPage),
        [filteredServices, pageStartIndex, itemsPerPage]
    );

    // Về trang 1 khi đổi bộ lọc, từ khóa hoặc chế độ xem
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, statusFilter, searchQuery, viewMode]);

    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages || page === safePage) return;
        setCurrentPage(page);
        const list = document.getElementById('admin-services-list');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Số trang hiển thị (có dấu … khi quá nhiều trang)
    const pageNumbers = useMemo(() => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages = [1];
        const start = Math.max(2, safePage - 1);
        const end = Math.min(totalPages - 1, safePage + 1);
        if (start > 2) pages.push('ellipsis-left');
        for (let p = start; p <= end; p++) pages.push(p);
        if (end < totalPages - 1) pages.push('ellipsis-right');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safePage]);

    // Xử lý mở Modal Thêm mới
    const handleOpenCreateModal = () => {
        setIsEditMode(false);
        setEditingServiceId(null);
        setFormData({
            name: '',
            category: categories[0]?.id || '',
            price: '',
            description: '',
            is_active: true,
            image_url: '',
        });
        setImageType('url');
        setSelectedFile(null);
        setFilePreview('');
        setFormError('');
        setIsModalOpen(true);
    };

    // Xử lý mở Modal Chỉnh sửa
    const handleOpenEditModal = (service) => {
        setIsEditMode(true);
        setEditingServiceId(service.id);
        setFormData({
            name: service.name || '',
            category: service.category_id || service.category || categories[0]?.id || '',
            price: String(Math.round(service.price || 0)),
            description: service.description || '',
            is_active: service.is_active ?? true,
            image_url: service.image_url || '',
        });
        setSelectedFile(null);
        setFilePreview(service.display_image || service.image || service.image_url || '');
        setImageType(service.image && !service.image_url ? 'file' : 'url');
        setFormError('');
        setIsModalOpen(true);
    };

    // Xử lý chọn file ảnh từ máy
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Kiểm tra dung lượng (< 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setFormError('File ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
            return;
        }

        setSelectedFile(file);
        setFilePreview(URL.createObjectURL(file));
        setFormError('');
    };

    // Xử lý Submit Form Thêm / Sửa
    const handleSubmitService = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.name.trim()) {
            setFormError('Vui lòng nhập tên dịch vụ / món ăn.');
            return;
        }
        if (!formData.category) {
            setFormError('Vui lòng chọn nhóm danh mục cho dịch vụ.');
            return;
        }
        const priceNum = Number(formData.price);
        if (isNaN(priceNum) || priceNum < 0) {
            setFormError('Đơn giá không hợp lệ. Vui lòng nhập số tiền hợp lệ (>= 0).');
            return;
        }

        setSubmitting(true);
        try {
            let res;
            if (imageType === 'file' && selectedFile) {
                // Sử dụng FormData nếu có file tải lên
                const data = new FormData();
                data.append('name', formData.name.trim());
                data.append('category', formData.category);
                data.append('category_id', formData.category);
                data.append('price', Math.round(priceNum));
                data.append('description', formData.description.trim());
                data.append('is_active', formData.is_active ? 'true' : 'false');
                data.append('image', selectedFile);
                if (formData.image_url.trim()) {
                    data.append('image_url', formData.image_url.trim());
                }

                if (isEditMode) {
                    res = await hotelService.updateServiceItem(editingServiceId, data);
                } else {
                    res = await hotelService.createServiceItem(data);
                }
            } else {
                // Gửi payload JSON
                const payload = {
                    name: formData.name.trim(),
                    category: Number(formData.category),
                    category_id: Number(formData.category),
                    price: Math.round(priceNum),
                    description: formData.description.trim(),
                    is_active: Boolean(formData.is_active),
                    image_url: formData.image_url.trim(),
                };

                if (isEditMode) {
                    res = await hotelService.updateServiceItem(editingServiceId, payload);
                } else {
                    res = await hotelService.createServiceItem(payload);
                }
            }

            if (res.success) {
                showToast('success', res.message || (isEditMode ? 'Cập nhật thành công!' : 'Thêm dịch vụ mới thành công!'));
                setIsModalOpen(false);
                loadAllData();
            } else {
                setFormError(res.message || 'Không thể lưu dịch vụ. Vui lòng kiểm tra lại dữ liệu.');
            }
        } catch (error) {
            console.error('Lỗi khi lưu dịch vụ:', error);
            setFormError('Có lỗi xảy ra khi lưu thông tin. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    // Xử lý bật/tắt nhanh trạng thái phục vụ
    const handleToggleActive = async (service) => {
        try {
            const res = await hotelService.toggleServiceItemStatus(service.id);
            if (res.success) {
                showToast('success', res.message);
                setServices((prev) =>
                    prev.map((item) =>
                        item.id === service.id ? { ...item, is_active: res.is_active } : item
                    )
                );
            } else {
                showToast('error', res.message);
            }
        } catch (error) {
            console.error('Lỗi khi đổi trạng thái:', error);
            showToast('error', 'Không thể thay đổi trạng thái dịch vụ.');
        }
    };

    // Xử lý mở Modal xác nhận xóa
    const handleOpenDeleteModal = (service) => {
        setServiceToDelete(service);
        setIsDeleteModalOpen(true);
    };

    // Thực hiện xóa dịch vụ
    const handleConfirmDelete = async () => {
        if (!serviceToDelete) return;
        setDeleting(true);
        try {
            const res = await hotelService.deleteServiceItem(serviceToDelete.id);
            if (res.success) {
                showToast('success', res.message);
                setIsDeleteModalOpen(false);
                setServiceToDelete(null);
                setServices((prev) => prev.filter((item) => item.id !== serviceToDelete.id));
            } else {
                showToast('error', res.message);
            }
        } catch (error) {
            console.error('Lỗi khi xóa dịch vụ:', error);
            showToast('error', 'Có lỗi xảy ra khi xóa dịch vụ.');
        } finally {
            setDeleting(false);
        }
    };

    // Thêm nhóm danh mục mới
    const handleCreateCategory = async (e) => {
        e.preventDefault();
        if (!newCatData.name.trim()) return;

        setSubmittingCat(true);
        try {
            const res = await hotelService.createServiceCategory({
                name: newCatData.name.trim(),
                icon: newCatData.icon.trim() || '🍽️',
                description: newCatData.description.trim(),
            });

            if (res.success) {
                showToast('success', res.message);
                setIsCategoryModalOpen(false);
                setNewCatData({ name: '', icon: '🍽️', description: '' });
                loadAllData();
            } else {
                showToast('error', res.message);
            }
        } catch (error) {
            console.error('Lỗi khi tạo nhóm:', error);
            showToast('error', 'Không thể tạo nhóm dịch vụ.');
        } finally {
            setSubmittingCat(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* TOAST THÔNG BÁO NỔI */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 animate-bounce">
                    <div
                        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-xs font-bold border ${
                            toast.type === 'success'
                                ? 'bg-emerald-600 border-emerald-400'
                                : toast.type === 'error'
                                ? 'bg-rose-600 border-rose-400'
                                : 'bg-blue-600 border-blue-400'
                        }`}
                    >
                        <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            {/* BANNER HEADER & QUICK ACTIONS */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        
                        <span>Quản Lý Danh Mục Dịch Vụ</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                        Thêm mới, điều chỉnh bảng giá, bật/tắt trạng thái phục vụ và tải ảnh dịch vụ phòng. Các dịch vụ đang phục vụ sẽ tự động xuất hiện trên màn hình đặt món của khách hàng tại <strong>/services</strong>.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={loadAllData}
                        disabled={isLoading}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                        title="Tải lại dữ liệu"
                    >
                        <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>

                    <a
                        href="/services"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                    >
                        <span>👁️</span>
                        <span>Xem Menu Khách</span>
                        <span className="text-[10px] text-slate-400">↗</span>
                    </a>

                    <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-slate-900/20"
                    >
                        <span>📂</span>
                        <span>+ Thêm Nhóm</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/25 transition flex items-center gap-2 transform active:scale-95"
                    >
                        <span className="text-base leading-none">+</span>
                        <span>Thêm Dịch Vụ Mới</span>
                    </button>
                </div>
            </div>

            {/* 4 STATS CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            TỔNG DỊCH VỤ
                        </span>
                        <span className="text-2xl font-black text-slate-900 mt-0.5 block">
                            {stats.total}
                        </span>
                        <span className="text-[11px] text-slate-500">Món & Tiện ích trong menu</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                        🍽️
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                            ĐANG PHỤC VỤ
                        </span>
                        <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                            {stats.active}
                        </span>
                        <span className="text-[11px] text-emerald-600/80 font-medium">Hiển thị cho khách gọi</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                        🟢
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                            TẠM NGƯNG
                        </span>
                        <span className="text-2xl font-black text-amber-600 mt-0.5 block">
                            {stats.inactive}
                        </span>
                        <span className="text-[11px] text-amber-600/80 font-medium">Ẩn khỏi thực đơn khách</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
                        ⏸️
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
                            NHÓM DANH MỤC
                        </span>
                        <span className="text-2xl font-black text-purple-700 mt-0.5 block">
                            {stats.catCount}
                        </span>
                        <span className="text-[11px] text-purple-600/80 font-medium">Ẩm thực, Spa, Bar, Giặt ủi...</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                        📑
                    </div>
                </div>
            </div>

            {/* BỘ LỌC, TÌM KIẾM & CHẾ ĐỘ XEM */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                        🔍
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên dịch vụ, món ăn, mô tả..."
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Categories dropdown */}
                <div className="flex items-center gap-2 overflow-x-auto">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value="all">📂 Tất cả nhóm ({categories.length})</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.icon || '•'} {cat.name} ({cat.services_count || 0})
                            </option>
                        ))}
                    </select>

                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value="all">⚡ Tất cả trạng thái</option>
                        <option value="active">🟢 Đang phục vụ</option>
                        <option value="inactive">⏸️ Tạm ngưng</option>
                    </select>

                    {/* View mode toggle */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                                viewMode === 'grid'
                                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Hiển thị dạng thẻ ảnh"
                        >
                            <span>🍱</span>
                            <span className="hidden sm:inline">Lưới</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                                viewMode === 'table'
                                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Hiển thị dạng bảng chi tiết"
                        >
                            <span>📋</span>
                            <span className="hidden sm:inline">Bảng</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* DANH SÁCH DỊCH VỤ */}
            {isLoading ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-xs">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-bold text-sm">Đang tải danh mục dịch vụ PMS...</p>
                    <p className="text-xs text-slate-400 mt-1">Vui lòng chờ trong giây lát.</p>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-xs">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                        🔍
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Không tìm thấy dịch vụ nào</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Không có dịch vụ nào khớp với từ khóa tìm kiếm hoặc bộ lọc nhóm của bạn.
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition inline-flex items-center gap-2"
                    >
                        <span>+</span>
                        <span>Thêm dịch vụ mới ngay</span>
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* CHẾ ĐỘ XEM GRID CARDS */
                <div id="admin-services-list" className="scroll-mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                    {paginatedServices.map((service) => (
                        <div
                            key={service.id}
                            className={`group bg-white rounded-2xl border transition duration-200 flex flex-col overflow-hidden ${
                                service.is_active
                                    ? 'border-slate-200 hover:border-blue-400 hover:shadow-lg'
                                    : 'border-slate-200 bg-slate-50/70 opacity-80 hover:opacity-100'
                            }`}
                        >
                            {/* Card Image */}
                            <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                                {service.display_image || service.image || service.image_url ? (
                                    <img
                                        src={service.display_image || service.image || service.image_url}
                                        alt={service.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                        onError={(e) => {
                                            e.target.src =
                                                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                                        <span className="text-3xl mb-1">{service.category_icon || '🛎️'}</span>
                                        <span className="text-[11px]">Chưa có ảnh</span>
                                    </div>
                                )}

                                {/* Category Badge */}
                                <div className="absolute top-3 left-3">
                                    <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold shadow-md flex items-center gap-1">
                                        <span>{service.category_icon || '•'}</span>
                                        <span>{service.category_name}</span>
                                    </span>
                                </div>

                                {/* Status Switch Badge */}
                                <div className="absolute top-3 right-3">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleActive(service)}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-black shadow-md border backdrop-blur-md transition flex items-center gap-1.5 ${
                                            service.is_active
                                                ? 'bg-emerald-600/90 hover:bg-emerald-700 text-white border-emerald-400'
                                                : 'bg-amber-600/90 hover:bg-amber-700 text-white border-amber-400'
                                        }`}
                                        title="Bấm để bật / tắt trạng thái phục vụ"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                        <span>{service.is_active ? 'Đang phục vụ' : 'Tạm ngưng'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1 group-hover:text-blue-600 transition">
                                            {service.name}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-3">
                                        {service.description || 'Chưa có mô tả chi tiết cho dịch vụ này.'}
                                    </p>
                                </div>

                                <div>
                                    <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between mb-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            ĐƠN GIÁ
                                        </span>
                                        <span className="text-base font-black text-rose-600">
                                            {Number(service.price || 0).toLocaleString('vi-VN')}
                                            <span className="text-[10px] font-semibold text-slate-400 ml-1">
                                                VND
                                            </span>
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditModal(service)}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                                        >
                                            <span>✏️</span>
                                            <span>Chỉnh sửa</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDeleteModal(service)}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                                        >
                                            <span>🗑️</span>
                                            <span>Xóa</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* CHẾ ĐỘ XEM TABLE VIEW */
                <div id="admin-services-list" className="scroll-mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="py-3.5 px-4">Dịch vụ / Món ăn</th>
                                    <th className="py-3.5 px-4">Nhóm danh mục</th>
                                    <th className="py-3.5 px-4">Đơn giá (VND)</th>
                                    <th className="py-3.5 px-4">Mô tả tóm tắt</th>
                                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedServices.map((service) => (
                                    <tr key={service.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={
                                                        service.display_image ||
                                                        service.image ||
                                                        service.image_url ||
                                                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80'
                                                    }
                                                    alt={service.name}
                                                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs"
                                                />
                                                <div>
                                                    <strong className="text-slate-900 font-bold block text-xs">
                                                        {service.name}
                                                    </strong>
                                                    <span className="text-[10px] text-slate-400">ID #{service.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                                                <span>{service.category_icon || '•'}</span>
                                                <span>{service.category_name}</span>
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className="font-black text-rose-600 text-xs">
                                                {Number(service.price || 0).toLocaleString('vi-VN')} VND
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 max-w-xs text-slate-500 truncate">
                                            {service.description || 'Chưa có mô tả'}
                                        </td>
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(service)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                                                    service.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        service.is_active ? 'bg-emerald-500' : 'bg-amber-500'
                                                    }`}
                                                ></span>
                                                <span>{service.is_active ? 'Đang phục vụ' : 'Tạm ngưng'}</span>
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(service)}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-[11px] transition shadow-2xs"
                                                >
                                                    Sửa
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDeleteModal(service)}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-700 font-bold text-[11px] transition shadow-2xs"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PHÂN TRANG */}
            {!isLoading && filteredServices.length > itemsPerPage && (
                <nav
                    aria-label="Phân trang dịch vụ"
                    className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3"
                >
                    <p className="text-xs text-slate-500">
                        Hiển thị{' '}
                        <strong className="text-slate-800">
                            {pageStartIndex + 1}–{Math.min(pageStartIndex + itemsPerPage, filteredServices.length)}
                        </strong>{' '}
                        trong tổng số{' '}
                        <strong className="text-slate-800">{filteredServices.length}</strong> dịch vụ
                    </p>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => handlePageChange(safePage - 1)}
                            disabled={safePage === 1}
                            aria-label="Trang trước"
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center justify-center transition cursor-pointer hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                        >
                            ‹
                        </button>

                        {pageNumbers.map((p) =>
                            typeof p === 'string' ? (
                                <span key={p} className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs select-none">
                                    …
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => handlePageChange(p)}
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
                            onClick={() => handlePageChange(safePage + 1)}
                            disabled={safePage === totalPages}
                            aria-label="Trang sau"
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center justify-center transition cursor-pointer hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                        >
                            ›
                        </button>
                    </div>
                </nav>
            )}

            {/* MODAL THÊM / SỬA DỊCH VỤ */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 animate-scale-up">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{isEditMode ? '✏️' : '✨'}</span>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base">
                                        {isEditMode ? 'Chỉnh Sửa Dịch Vụ' : 'Thêm Dịch Vụ Mới'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {isEditMode
                                            ? 'Cập nhật giá, ảnh và thông tin hiển thị trên menu phòng'
                                            : 'Dịch vụ sau khi tạo sẽ lập tức hiển thị trên Menu /services'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-xs transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitService} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Tên dịch vụ */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tên Dịch Vụ / Món Ăn <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="VD: Bò Wagyu A5 Nướng Than Hoa, Trà Chiều Hoàng Gia..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                                    required
                                />
                            </div>

                            {/* Nhóm danh mục & Đơn giá */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Thuộc Nhóm Danh Mục <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                                        required
                                    >
                                        <option value="">-- Chọn nhóm danh mục --</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.icon || '•'} {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Đơn Giá (VND) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            placeholder="VD: 450000"
                                            min="0"
                                            step="1000"
                                            className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition font-bold"
                                            required
                                        />
                                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-slate-400 pointer-events-none">
                                            VND
                                        </span>
                                    </div>
                                    {formData.price && !isNaN(Number(formData.price)) && (
                                        <span className="text-[10px] text-blue-600 font-semibold mt-1 block">
                                            = {Number(formData.price).toLocaleString('vi-VN')} đ
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Trạng thái phục vụ (Toggle) */}
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">
                                        Trạng thái hiển thị & phục vụ
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        {formData.is_active
                                            ? 'Dịch vụ đang hoạt động và khách có thể đặt tại phòng.'
                                            : 'Dịch vụ tạm ngưng và sẽ được ẩn khỏi Menu của khách.'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        formData.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                            formData.is_active ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Mô tả chi tiết */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Mô Tả Chi Tiết
                                </label>
                                <textarea
                                    rows="2"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Mô tả nguyên liệu, hương vị hoặc dịch vụ đi kèm để khách hàng lựa chọn..."
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition resize-none"
                                />
                            </div>

                            {/* HÌNH ẢNH DỊCH VỤ (Upload File / URL) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700">Hình Ảnh Dịch Vụ</label>
                                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
                                        <button
                                            type="button"
                                            onClick={() => setImageType('url')}
                                            className={`px-2.5 py-1 rounded-md transition ${
                                                imageType === 'url' ? 'bg-white text-blue-600 shadow-xs' : ''
                                            }`}
                                        >
                                            🔗 Link Ảnh Trực Tuyến
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setImageType('file')}
                                            className={`px-2.5 py-1 rounded-md transition ${
                                                imageType === 'file' ? 'bg-white text-blue-600 shadow-xs' : ''
                                            }`}
                                        >
                                            📁 Tải Ảnh Lên Máy
                                        </button>
                                    </div>
                                </div>

                                {imageType === 'url' ? (
                                    <div>
                                        <input
                                            type="url"
                                            value={formData.image_url}
                                            onChange={(e) => {
                                                setFormData({ ...formData, image_url: e.target.value });
                                                setFilePreview(e.target.value);
                                            }}
                                            placeholder="https://images.unsplash.com/photo-..."
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            Dán link ảnh độ phân giải cao từ Unsplash hoặc CDN.
                                        </span>
                                    </div>
                                ) : (
                                    <div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-5 text-center cursor-pointer transition"
                                        >
                                            <span className="text-2xl block mb-1">📸</span>
                                            <span className="text-xs font-bold text-slate-700 block">
                                                Bấm để chọn ảnh từ máy tính
                                            </span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                                                Hỗ trợ JPG, PNG, WEBP tối đa 5MB
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Image Preview */}
                                {filePreview && (
                                    <div className="relative mt-2 rounded-2xl overflow-hidden border border-slate-200 h-36 bg-slate-100 flex items-center justify-center">
                                        <img
                                            src={filePreview}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={() => setFilePreview('')}
                                        />
                                        <div className="absolute top-2 right-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFilePreview('');
                                                    setSelectedFile(null);
                                                    setFormData({ ...formData, image_url: '' });
                                                }}
                                                className="w-6 h-6 rounded-full bg-slate-900/80 text-white text-xs flex items-center justify-center hover:bg-rose-600 transition"
                                                title="Gỡ ảnh"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer Buttons */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                                >
                                    Hủy Bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/25 transition flex items-center gap-2"
                                >
                                    {submitting && (
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    )}
                                    <span>{isEditMode ? 'Lưu Thay Đổi' : 'Thêm Dịch Vụ'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL THÊM NHÓM DANH MỤC */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 p-6 animate-scale-up">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">📂</span>
                                <h3 className="font-black text-slate-900 text-base">Thêm Nhóm Danh Mục</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCategoryModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateCategory} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tên Nhóm Dịch Vụ <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCatData.name}
                                    onChange={(e) => setNewCatData({ ...newCatData, name: e.target.value })}
                                    placeholder="VD: Tour & Trải Nghiệm, Xe Đưa Đón..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Icon / Emoji Đại Diện
                                </label>
                                <input
                                    type="text"
                                    value={newCatData.icon}
                                    onChange={(e) => setNewCatData({ ...newCatData, icon: e.target.value })}
                                    placeholder="VD: ⛵, 🎯, 🍷, 🥐"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả Nhóm</label>
                                <textarea
                                    rows="2"
                                    value={newCatData.description}
                                    onChange={(e) => setNewCatData({ ...newCatData, description: e.target.value })}
                                    placeholder="Mô tả nhóm dịch vụ..."
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsCategoryModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingCat}
                                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
                                >
                                    {submittingCat && (
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    )}
                                    <span>Tạo Nhóm</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN XÓA DỊCH VỤ */}
            {isDeleteModalOpen && serviceToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 p-6 animate-scale-up text-center">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-3">
                            🗑️
                        </div>
                        <h3 className="font-black text-slate-900 text-base">Xác Nhận Xóa Dịch Vụ?</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                            Bạn có chắc chắn muốn xóa dịch vụ{' '}
                            <strong className="text-slate-900">"{serviceToDelete.name}"</strong> khỏi hệ thống?
                        </p>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 text-left mt-4">
                            ⚠️ <strong>Lưu ý:</strong> Nếu dịch vụ đang có yêu cầu phục vụ chưa hoàn tất, hệ thống sẽ yêu cầu bạn tạm ngưng phục vụ thay vì xóa bỏ.
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/25 transition flex items-center gap-2"
                            >
                                {deleting && (
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                )}
                                <span>Xác Nhận Xóa</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
