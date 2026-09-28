import React, { useState, useEffect, useRef } from 'react';
import roomService from '../../services/roomService';

export default function CategoryManagement() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('price_asc');

    // State cho Modal Thêm/Sửa
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // State dữ liệu Form
    const [formData, setFormData] = useState({
        name: '',
        base_price: '',
        promo_price: '',
        capacity: 2,
        size: 35,
        bed_type: '1 Giường Đôi King Size',
        description: '',
    });

    // State cho quản lý Upload ảnh
    // selectedFiles: mảng các File object mới được chọn từ máy
    const [selectedFiles, setSelectedFiles] = useState([]);
    // filePreviews: mảng các object { file, previewUrl, id }
    const [filePreviews, setFilePreviews] = useState([]);
    // featureImageIndex: chỉ số của file mới làm ảnh đại diện (mặc định 0)
    const [featureImageIndex, setFeatureImageIndex] = useState(0);

    // Ảnh hiện có trong CSDL (dành cho chế độ Sửa)
    const [existingImages, setExistingImages] = useState([]);
    const [existingFeatureId, setExistingFeatureId] = useState(null);
    const [deletedImageIds, setDeletedImageIds] = useState([]);

    // State cho Modal Xóa
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const fileInputRef = useRef(null);

    // Tải danh sách Hạng phòng từ Backend
    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await roomService.getCategories({ q: searchQuery });
            if (res.success && res.categories) {
                setCategories(res.categories);
            } else if (Array.isArray(res)) {
                setCategories(res);
            } else if (res.results) {
                setCategories(res.results);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [searchQuery]);

    // Xử lý khi chọn file ảnh từ máy tính (hỗ trợ chọn nhiều file)
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...selectedFiles, ...files];
        setSelectedFiles(newFiles);

        const newPreviews = files.map((file, idx) => ({
            id: `new-${Date.now()}-${idx}-${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
        }));

        setFilePreviews((prev) => [...prev, ...newPreviews]);
        setFormError('');
    };

    // Xóa một file ảnh mới chọn khỏi danh sách tải lên
    const handleRemoveNewFile = (indexToRemove) => {
        // Thu hồi URL tạm để tránh rò rỉ bộ nhớ
        if (filePreviews[indexToRemove]?.previewUrl) {
            URL.revokeObjectURL(filePreviews[indexToRemove].previewUrl);
        }

        const updatedFiles = selectedFiles.filter((_, idx) => idx !== indexToRemove);
        const updatedPreviews = filePreviews.filter((_, idx) => idx !== indexToRemove);

        setSelectedFiles(updatedFiles);
        setFilePreviews(updatedPreviews);

        if (featureImageIndex >= updatedFiles.length) {
            setFeatureImageIndex(Math.max(0, updatedFiles.length - 1));
        }
    };

    // Đánh dấu ảnh cũ trong CSDL để xóa
    const handleToggleDeleteExistingImage = (imageId) => {
        if (deletedImageIds.includes(imageId)) {
            setDeletedImageIds(deletedImageIds.filter((id) => id !== imageId));
        } else {
            setDeletedImageIds([...deletedImageIds, imageId]);
            // Nếu xóa trúng ảnh đang là feature, bỏ chọn
            if (existingFeatureId === imageId) {
                const remaining = existingImages.filter(
                    (img) => img.id !== imageId && !deletedImageIds.includes(img.id)
                );
                if (remaining.length > 0) {
                    setExistingFeatureId(remaining[0].id);
                } else {
                    setExistingFeatureId(null);
                }
            }
        }
    };

    // Đặt một ảnh cũ làm ảnh đại diện
    const handleSetExistingFeature = (imageId) => {
        setExistingFeatureId(imageId);
        setFeatureImageIndex(-1); // Đánh dấu dùng ảnh cũ làm feature
    };

    // Đặt một ảnh mới làm ảnh đại diện
    const handleSetNewFeature = (index) => {
        setFeatureImageIndex(index);
        setExistingFeatureId(null); // Bỏ chọn ảnh cũ
    };

    // Mở modal Thêm mới
    const handleOpenCreateModal = () => {
        setIsEditMode(false);
        setCurrentCategory(null);
        setFormData({
            name: '',
            base_price: '',
            promo_price: '',
            capacity: 2,
            size: 35,
            bed_type: '1 Giường Đôi King Size',
            description: '',
        });
        setSelectedFiles([]);
        setFilePreviews([]);
        setFeatureImageIndex(0);
        setExistingImages([]);
        setExistingFeatureId(null);
        setDeletedImageIds([]);
        setFormError('');
        setFormSuccess('');
        setIsModalOpen(true);
    };

    // Mở modal Chỉnh sửa
    const handleOpenEditModal = (cat) => {
        setIsEditMode(true);
        setCurrentCategory(cat);
        setFormData({
            name: cat.name || '',
            base_price: cat.base_price || '',
            promo_price: cat.promo_price || '',
            capacity: cat.capacity || 2,
            size: cat.size || 35,
            bed_type: cat.bed_type || '1 Giường Đôi King Size',
            description: cat.description || '',
        });
        setSelectedFiles([]);
        setFilePreviews([]);
        setFeatureImageIndex(-1);

        // Lưu danh sách ảnh hiện có
        const currentImgs = cat.images || [];
        setExistingImages(currentImgs);
        const feat = currentImgs.find((img) => img.is_feature) || currentImgs[0];
        setExistingFeatureId(feat ? feat.id : null);
        setDeletedImageIds([]);
        setFormError('');
        setFormSuccess('');
        setIsModalOpen(true);
    };

    // Đóng Modal và dọn dẹp URL tạm
    const handleCloseModal = () => {
        filePreviews.forEach((item) => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        setSelectedFiles([]);
        setFilePreviews([]);
        setIsModalOpen(false);
    };

    // Gửi Form (bắt buộc dùng FormData và Content-Type: multipart/form-data)
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');

        if (!formData.name.trim()) {
            setFormError('Vui lòng nhập tên hạng phòng.');
            return;
        }
        if (!formData.base_price || Number(formData.base_price) <= 0) {
            setFormError('Vui lòng nhập giá gốc hợp lệ (> 0 VND).');
            return;
        }

        setFormSubmitting(true);

        try {
            // Khởi tạo đối tượng FormData theo đúng chuẩn
            const form = new FormData();
            form.append('name', formData.name.trim());
            form.append('base_price', formData.base_price);
            if (formData.promo_price) {
                form.append('promo_price', formData.promo_price);
            } else {
                form.append('promo_price', '');
            }
            form.append('capacity', formData.capacity);
            form.append('size', formData.size);
            form.append('bed_type', formData.bed_type);
            form.append('description', formData.description || '');

            // Đính kèm các file ảnh mới chọn
            selectedFiles.forEach((file) => {
                form.append('images', file);
            });

            // Gắn chỉ số ảnh đại diện nếu có
            if (featureImageIndex >= 0) {
                form.append('feature_image_index', featureImageIndex);
            }

            if (isEditMode && currentCategory) {
                // Nếu đang chỉnh sửa: gửi thêm ID ảnh cần xóa & ảnh đại diện
                if (existingFeatureId) {
                    form.append('feature_image_id', existingFeatureId);
                }
                if (deletedImageIds.length > 0) {
                    form.append('delete_image_ids', deletedImageIds.join(','));
                }

                const res = await roomService.updateCategory(currentCategory.id, form);
                if (res.success) {
                    setFormSuccess(`Cập nhật hạng phòng "${formData.name}" thành công!`);
                    setTimeout(() => {
                        handleCloseModal();
                        fetchCategories();
                    }, 1200);
                } else {
                    setFormError(res.message || 'Cập nhật thất bại. Vui lòng kiểm tra lại thông tin.');
                }
            } else {
                // Tạo mới
                const res = await roomService.createCategory(form);
                if (res.success) {
                    setFormSuccess(`Thêm mới hạng phòng "${formData.name}" thành công!`);
                    setTimeout(() => {
                        handleCloseModal();
                        fetchCategories();
                    }, 1200);
                } else {
                    setFormError(res.message || 'Thêm hạng phòng thất bại.');
                }
            }
        } catch (error) {
            console.error('Submit error:', error);
            setFormError(error.response?.data?.message || 'Có lỗi xảy ra trong quá trình gửi dữ liệu.');
        } finally {
            setFormSubmitting(false);
        }
    };

    // Mở Modal Xóa Hạng Phòng
    const handleOpenDeleteModal = (cat) => {
        setCategoryToDelete(cat);
        setDeleteError('');
        setIsDeleteModalOpen(true);
    };

    // Thực hiện xóa Hạng Phòng
    const handleConfirmDelete = async () => {
        if (!categoryToDelete) return;
        setDeleteLoading(true);
        setDeleteError('');

        try {
            const res = await roomService.deleteCategory(categoryToDelete.id);
            if (res.success) {
                setIsDeleteModalOpen(false);
                setCategoryToDelete(null);
                fetchCategories();
            } else {
                setDeleteError(res.message || 'Không thể xóa hạng phòng này.');
            }
        } catch (error) {
            setDeleteError(error.response?.data?.message || 'Lỗi hệ thống khi xóa.');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Sắp xếp danh sách
    const sortedCategories = [...categories].sort((a, b) => {
        if (sortBy === 'price_asc') return Number(a.base_price) - Number(b.base_price);
        if (sortBy === 'price_desc') return Number(b.base_price) - Number(a.base_price);
        if (sortBy === 'size_desc') return Number(b.size) - Number(a.size);
        if (sortBy === 'capacity_desc') return Number(b.capacity) - Number(a.capacity);
        return 0;
    });

    // Thống kê tổng hợp
    const totalCategories = categories.length;
    const totalImagesCount = categories.reduce((acc, cat) => acc + (cat.images?.length || 0), 0);
    const minPrice = categories.length > 0
        ? Math.min(...categories.map((c) => Number(c.base_price)))
        : 0;
    const maxPrice = categories.length > 0
        ? Math.max(...categories.map((c) => Number(c.base_price)))
        : 0;

    return (
        <div className="space-y-6">
            {/* 1. HEADER & KPI CARDS */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                            PMS ROOM CATEGORIES & SUITES
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">Quản lý tiêu chuẩn phòng 5 sao</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Quản Lý Hạng Phòng & Bảng Giá
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                        Cấu hình diện tích, sức chứa, giá niêm yết theo đêm và bộ sưu tập hình ảnh phòng chất lượng cao phục vụ hiển thị trực tiếp cho khách hàng.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition transform active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Thêm hạng phòng</span>
                    </button>
                </div>
            </div>

            {/* 2. STATS KPI OVERVIEW */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                        🏨
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Tổng Hạng Phòng
                        </span>
                        <span className="text-2xl font-black text-slate-900">{totalCategories}</span>
                        <span className="text-[10px] text-slate-500 block">Đang mở bán</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                        💵
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Giá Khởi Điểm
                        </span>
                        <span className="text-xl font-black text-emerald-600">
                            {minPrice > 0 ? Number(minPrice).toLocaleString('vi-VN') : '0'} đ
                        </span>
                        <span className="text-[10px] text-slate-500 block">Theo đêm (Từ phòng Deluxe)</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
                        👑
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Hạng Cao Cấp Nhất
                        </span>
                        <span className="text-xl font-black text-amber-600">
                            {maxPrice > 0 ? Number(maxPrice).toLocaleString('vi-VN') : '0'} đ
                        </span>
                        <span className="text-[10px] text-slate-500 block">Presidential Penthouse</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                        🖼️
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Bộ Sưu Tập Hình Ảnh
                        </span>
                        <span className="text-2xl font-black text-indigo-600">{totalImagesCount}</span>
                        <span className="text-[10px] text-slate-500 block">Hình ảnh 5 sao đã upload</span>
                    </div>
                </div>
            </div>

            {/* 3. BỘ LỌC & TÌM KIẾM */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên hạng phòng, loại giường..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="text-xs text-slate-400 whitespace-nowrap">Sắp xếp:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                        <option value="price_asc">Giá tăng dần (Thấp → Cao)</option>
                        <option value="price_desc">Giá giảm dần (Cao → Thấp)</option>
                        <option value="size_desc">Diện tích lớn nhất</option>
                        <option value="capacity_desc">Sức chứa nhiều nhất</option>
                    </select>
                </div>
            </div>

            {/* 4. GRID DANH SÁCH HẠNG PHÒNG */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4">
                            <div className="h-48 bg-slate-200 rounded-xl"></div>
                            <div className="h-5 bg-slate-200 rounded w-1/2"></div>
                            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                            <div className="h-10 bg-slate-100 rounded"></div>
                        </div>
                    ))}
                </div>
            ) : sortedCategories.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <div className="text-4xl mb-3">🏨</div>
                    <h3 className="text-base font-bold text-slate-900">Không tìm thấy hạng phòng nào</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Hãy thử tìm kiếm với từ khóa khác hoặc nhấn "+ Thêm Hạng Phòng Mới" để bắt đầu.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sortedCategories.map((cat) => {
                        const featureImg = cat.feature_image || cat.images?.[0]?.image_url || cat.images?.[0]?.image;
                        const hasPromo = cat.promo_price && Number(cat.promo_price) > 0 && Number(cat.promo_price) < Number(cat.base_price);
                        const discountPercent = hasPromo
                            ? Math.round(((Number(cat.base_price) - Number(cat.promo_price)) / Number(cat.base_price)) * 100)
                            : 0;

                        return (
                            <div
                                key={cat.id}
                                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group"
                            >
                                {/* Ảnh bìa chính */}
                                <div className="relative h-56 sm:h-64 bg-slate-100 overflow-hidden">
                                    {featureImg ? (
                                        <img
                                            src={featureImg}
                                            alt={cat.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                                            <span className="text-3xl mb-1">🖼️</span>
                                            <span className="text-xs font-medium">Chưa có ảnh đại diện</span>
                                        </div>
                                    )}

                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20 pointer-events-none"></div>

                                    {/* Badges trên ảnh */}
                                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold border border-white/20">
                                            📷 {cat.images?.length || 0} ảnh
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-blue-600/90 backdrop-blur-md text-white text-[11px] font-bold shadow-sm">
                                            🚪 {cat.total_rooms_count || 0} phòng thực tế
                                        </span>
                                        {hasPromo && (
                                            <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider shadow-sm animate-pulse">
                                                GIẢM {discountPercent}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Action buttons góc phải trên ảnh */}
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditModal(cat)}
                                            className="p-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 shadow-md backdrop-blur-md transition transform hover:scale-105"
                                            title="Chỉnh sửa thông tin & ảnh"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDeleteModal(cat)}
                                            className="p-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 hover:text-rose-600 shadow-md backdrop-blur-md transition transform hover:scale-105"
                                            title="Xóa hạng phòng"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Tên & giá dưới chân ảnh */}
                                    <div className="absolute bottom-3 left-3 right-3 text-white">
                                        <h3 className="text-lg sm:text-xl font-bold font-serif drop-shadow-md truncate">
                                            {cat.name}
                                        </h3>
                                        <div className="flex items-baseline gap-2 mt-0.5">
                                            {hasPromo ? (
                                                <>
                                                    <span className="text-xl sm:text-2xl font-black text-rose-300 drop-shadow">
                                                        {Number(cat.promo_price).toLocaleString('vi-VN')} đ
                                                    </span>
                                                    <span className="text-xs line-through text-slate-300">
                                                        {Number(cat.base_price).toLocaleString('vi-VN')} đ
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-xl sm:text-2xl font-black text-white drop-shadow">
                                                    {Number(cat.base_price).toLocaleString('vi-VN')} đ
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-200 uppercase font-semibold">/ đêm</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Body Card */}
                                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                    {/* Thông số kỹ thuật */}
                                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                        <div className="flex items-center gap-1.5 text-slate-700">
                                            <span>📐</span>
                                            <span className="font-semibold">{cat.size} m²</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-700">
                                            <span>👥</span>
                                            <span className="font-semibold">{cat.capacity} người lớn</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-700 truncate" title={cat.bed_type}>
                                            <span>🛏️</span>
                                            <span className="font-semibold truncate">{cat.bed_type}</span>
                                        </div>
                                    </div>

                                    {/* Mô tả ngắn */}
                                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                        {cat.description || 'Chưa có mô tả chi tiết cho hạng phòng này.'}
                                    </p>

                                    {/* Dải ảnh nhỏ preview bộ sưu tập */}
                                    {cat.images && cat.images.length > 0 && (
                                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Bộ sưu tập ảnh ({cat.images.length})
                                            </span>
                                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                                {cat.images.map((img) => (
                                                    <div
                                                        key={img.id}
                                                        className={`relative w-14 h-11 rounded-lg overflow-hidden shrink-0 border-2 ${
                                                            img.is_feature ? 'border-amber-500 shadow-xs' : 'border-slate-200'
                                                        }`}
                                                    >
                                                        <img
                                                            src={img.image_url || img.image}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {img.is_feature && (
                                                            <span className="absolute bottom-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-1 rounded-tl">
                                                                ★
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Nút hành động chân card */}
                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[11px] text-slate-400 font-mono">
                                            Slug: {cat.slug}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(cat)}
                                                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                                            >
                                                Sửa & Thêm Ảnh
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 5. MODAL THÊM / CHỈNH SỬA HẠNG PHÒNG (TIÊU ĐỀ NỀN TRẮNG THANH LỊCH) */}
            {/* ========================================================================= */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
                    <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col max-h-[90vh]">
                        {/* Tiêu đề nền trắng thanh lịch theo chuẩn hệ thống */}
                        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-lg">
                                    {isEditMode ? '✏️' : '🏨'}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        {isEditMode ? `Chỉnh Sửa Hạng Phòng: ${currentCategory?.name}` : 'Thêm Mới Hạng Phòng & Upload Hình Ảnh'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {isEditMode
                                            ? 'Cập nhật giá, sức chứa, quản lý ảnh đại diện & bổ sung ảnh mới'
                                            : 'Điền thông tin hạng phòng và tải lên nhiều hình ảnh chất lượng cao'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thông báo kết quả / lỗi */}
                        {formError && (
                            <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                                <span>⚠️</span>
                                <span>{formError}</span>
                            </div>
                        )}
                        {formSuccess && (
                            <div className="mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                                <span>✓</span>
                                <span>{formSuccess}</span>
                            </div>
                        )}

                        {/* Form Body cuộn được */}
                        <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Khối 1: Thông tin cơ bản */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                    1. Thông tin cơ bản
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Tên Hạng Phòng <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="VD: Deluxe King City View, Premier Oceanfront Suite..."
                                            required
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Giá Gốc / Đêm (VND) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.base_price}
                                            onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                                            placeholder="VD: 2500000"
                                            required
                                            min="1000"
                                            step="1000"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Giá Khuyến Mãi (VND - Tùy chọn)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.promo_price}
                                            onChange={(e) => setFormData({ ...formData, promo_price: e.target.value })}
                                            placeholder="Để trống nếu không có KM"
                                            min="0"
                                            step="1000"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Diện Tích (m²) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.size}
                                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                                            placeholder="VD: 45.5"
                                            required
                                            min="10"
                                            step="0.5"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Sức Chứa Người Lớn <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.capacity}
                                            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                            placeholder="VD: 2"
                                            required
                                            min="1"
                                            max="10"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Loại Giường <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.bed_type}
                                            onChange={(e) => setFormData({ ...formData, bed_type: e.target.value })}
                                            placeholder="VD: 1 Giường Đôi King Size, 2 Giường Đơn Twin..."
                                            required
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Mô Tả Chi Tiết Hạng Phòng
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Mô tả không gian, tầm nhìn, trang thiết bị nổi bật của phòng..."
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Khối 2: Quản lý Hình Ảnh (Tải lên nhiều ảnh) */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                        2. Bộ sưu tập Hình ảnh (Upload File)
                                    </h4>
                                    <span className="text-[11px] text-slate-500">
                                        Hỗ trợ định dạng JPG, PNG, WEBP (Tối đa 10 ảnh)
                                    </span>
                                </div>

                                {/* Drag & Drop / File Input Box */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/60 hover:bg-blue-50/30 transition group"
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition">
                                        📸
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">
                                        Nhấn để chọn ảnh từ máy tính (Có thể chọn nhiều ảnh cùng lúc)
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Hệ thống tự động xử lý và gửi qua chuẩn <strong>FormData (multipart/form-data)</strong>
                                    </p>
                                </div>

                                {/* Danh sách ảnh mới chuẩn bị tải lên */}
                                {filePreviews.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">
                                                Ảnh mới chuẩn bị upload ({filePreviews.length}):
                                            </span>
                                            <span className="text-[11px] text-blue-600">
                                                Click vào ảnh hoặc nút sao để chọn làm "Ảnh Đại Diện"
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {filePreviews.map((item, idx) => {
                                                const isFeat = featureImageIndex === idx;
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`relative rounded-xl overflow-hidden border-2 transition ${
                                                            isFeat ? 'border-amber-500 shadow-md ring-2 ring-amber-500/20' : 'border-slate-200'
                                                        }`}
                                                    >
                                                        <img
                                                            src={item.previewUrl}
                                                            alt={item.name}
                                                            className="w-full h-24 object-cover"
                                                        />
                                                        {/* Badge trạng thái */}
                                                        <div className="absolute top-1 left-1">
                                                            {isFeat ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-black uppercase shadow-xs">
                                                                    ★ ẢNH CHÍNH
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSetNewFeature(idx);
                                                                    }}
                                                                    className="px-1.5 py-0.5 rounded bg-slate-900/70 hover:bg-amber-500 text-white text-[9px] font-semibold transition"
                                                                >
                                                                    Đặt làm chính
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Nút xóa ảnh */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveNewFile(idx);
                                                            }}
                                                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center hover:bg-rose-700 transition shadow-xs"
                                                            title="Bỏ ảnh này"
                                                        >
                                                            ✕
                                                        </button>

                                                        <div className="p-1.5 bg-white text-[10px] text-slate-500 truncate">
                                                            {item.name}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Trong chế độ Sửa: Danh sách ảnh hiện có trong CSDL */}
                                {isEditMode && existingImages.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">
                                                Ảnh hiện có trong cơ sở dữ liệu ({existingImages.length}):
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                Gạch đỏ = sẽ bị xóa khi lưu
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {existingImages.map((img) => {
                                                const isMarkedDelete = deletedImageIds.includes(img.id);
                                                const isFeat = existingFeatureId === img.id && !isMarkedDelete;

                                                return (
                                                    <div
                                                        key={img.id}
                                                        className={`relative rounded-xl overflow-hidden border-2 transition ${
                                                            isMarkedDelete
                                                                ? 'border-rose-400 opacity-40 grayscale'
                                                                : isFeat
                                                                ? 'border-amber-500 shadow-md ring-2 ring-amber-500/20'
                                                                : 'border-slate-200'
                                                        }`}
                                                    >
                                                        <img
                                                            src={img.image_url || img.image}
                                                            alt=""
                                                            className="w-full h-24 object-cover"
                                                        />

                                                        {/* Badge ảnh chính */}
                                                        {!isMarkedDelete && (
                                                            <div className="absolute top-1 left-1">
                                                                {isFeat ? (
                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-black uppercase shadow-xs">
                                                                        ★ ẢNH CHÍNH
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSetExistingFeature(img.id)}
                                                                        className="px-1.5 py-0.5 rounded bg-slate-900/70 hover:bg-amber-500 text-white text-[9px] font-semibold transition"
                                                                    >
                                                                        Đặt làm chính
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Nút đánh dấu xóa */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleDeleteExistingImage(img.id)}
                                                            className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-xs transition ${
                                                                isMarkedDelete
                                                                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                                                                    : 'bg-rose-600 text-white hover:bg-rose-700'
                                                            }`}
                                                            title={isMarkedDelete ? 'Hủy xóa ảnh này' : 'Đánh dấu xóa ảnh'}
                                                        >
                                                            {isMarkedDelete ? 'Phục hồi' : 'Xóa'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer nút bấm */}
                            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    disabled={formSubmitting}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={formSubmitting}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition disabled:opacity-50"
                                >
                                    {formSubmitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            Đang lưu & Upload ảnh...
                                        </>
                                    ) : (
                                        <>
                                            <span>✓</span>
                                            {isEditMode ? 'Lưu Thay Đổi' : 'Tạo Hạng Phòng'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. MODAL XÁC NHẬN XÓA HẠNG PHÒNG */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && categoryToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                        {/* Header nền trắng thanh lịch */}
                        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 text-lg">
                                    🗑️
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Xóa Hạng Phòng</h3>
                                    <p className="text-xs text-slate-500">Thao tác này sẽ gỡ bỏ hạng phòng khỏi hệ thống</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {deleteError && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{deleteError}</span>
                                </div>
                            )}

                            <p className="text-xs text-slate-600 leading-relaxed">
                                Bạn có chắc chắn muốn xóa hạng phòng{' '}
                                <strong className="text-slate-900">"{categoryToDelete.name}"</strong> không?
                            </p>

                            {categoryToDelete.total_rooms_count > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <span>⚠️ Cảnh báo an toàn:</span>
                                    </div>
                                    <p>
                                        Hạng phòng này hiện đang có{' '}
                                        <strong>{categoryToDelete.total_rooms_count} phòng thực tế</strong> liên kết. Bạn cần chuyển hoặc xóa các phòng thực tế trước khi có thể xóa hạng phòng này.
                                    </p>
                                </div>
                            )}

                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    disabled={deleteLoading}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={deleteLoading || categoryToDelete.total_rooms_count > 0}
                                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 transition disabled:opacity-40"
                                >
                                    {deleteLoading ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
