import React, { useState, useEffect, useMemo } from 'react';
import {
    Sparkles,
    Plus,
    Search,
    Edit2,
    Trash2,
    RefreshCw,
    X,
    CheckCircle2,
    AlertCircle,
    Info,
    Check,
    Coffee,
    Tv,
    Wifi,
    Wind,
    Bath,
    Eye
} from 'lucide-react';
import { amenityService } from '../../services/amenityService';

// Danh sách gợi ý các icon / emoji tiện nghi phổ biến để Admin chọn nhanh
const SUGGESTED_ICONS = [
    { icon: '📶', label: 'Wifi' },
    { icon: '📺', label: 'Tivi' },
    { icon: '❄️', label: 'Điều hòa' },
    { icon: '☕', label: 'Cà phê' },
    { icon: '🛁', label: 'Bồn tắm' },
    { icon: '🌅', label: 'Ban công' },
    { icon: '💨', label: 'Máy sấy' },
    { icon: '🧊', label: 'Tủ lạnh' },
    { icon: '🔒', label: 'Két sắt' },
    { icon: '🍷', label: 'Minibar' },
    { icon: '🫖', label: 'Ấm đun' },
    { icon: '🏊', label: 'Hồ bơi' },
    { icon: '🍳', label: 'Bếp' },
    { icon: '🛎️', label: 'Phục vụ' },
    { icon: '🧴', label: 'Dầu gội' },
    { icon: '👕', label: 'Ủi đồ' }
];

export default function AmenityManagement() {
    // 1. STATE DỮ LIỆU
    const [amenities, setAmenities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // 2. STATE MODAL THÊM MỚI / CHỈNH SỬA
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [editingItem, setEditingItem] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '✨'
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

    // 5. GỌI API LẤY DANH SÁCH TIỆN NGHI (GET /api/rooms/amenities/)
    const fetchAmenities = async () => {
        setIsLoading(true);
        try {
            const res = await amenityService.getAmenities();
            if (res.success) {
                setAmenities(res.data || []);
            } else {
                showToast('error', res.message);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách tiện nghi:', error);
            showToast('error', 'Lỗi kết nối máy chủ khi lấy danh sách tiện nghi.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAmenities();
    }, []);

    // 6. LỌC TÌM KIẾM THEO TÊN HOẶC MÔ TẢ
    const filteredAmenities = useMemo(() => {
        if (!searchTerm.trim()) return amenities;
        const query = searchTerm.toLowerCase().trim();
        return amenities.filter(item =>
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            (item.id && String(item.id).includes(query))
        );
    }, [amenities, searchTerm]);

    // 7. MỞ MODAL THÊM MỚI
    const handleOpenCreateModal = () => {
        setModalMode('create');
        setEditingItem(null);
        setFormData({
            name: '',
            description: '',
            icon: '✨'
        });
        setIsModalOpen(true);
    };

    // 8. MỞ MODAL CẬP NHẬT
    const handleOpenEditModal = (item) => {
        setModalMode('edit');
        setEditingItem(item);
        setFormData({
            name: item.name || '',
            description: item.description || '',
            icon: item.icon || '✨'
        });
        setIsModalOpen(true);
    };

    // ĐÓNG MODAL FORM
    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setEditingItem(null);
    };

    // 9. SUBMIT FORM (POST THÊM MỚI HOẶC PUT CẬP NHẬT)
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('error', 'Vui lòng nhập tên tiện nghi.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                icon: formData.icon.trim() || '✨'
            };

            if (modalMode === 'create') {
                const res = await amenityService.createAmenity(payload);
                if (res.success) {
                    showToast('success', res.message || 'Thêm tiện nghi mới thành công!');
                    setIsModalOpen(false);
                    fetchAmenities();
                } else {
                    showToast('error', res.message);
                }
            } else if (modalMode === 'edit' && editingItem) {
                const res = await amenityService.updateAmenity(editingItem.id, payload);
                if (res.success) {
                    showToast('success', res.message || 'Cập nhật tiện nghi thành công!');
                    setIsModalOpen(false);
                    fetchAmenities();
                } else {
                    showToast('error', res.message);
                }
            }
        } catch (error) {
            console.error('Lỗi khi lưu tiện nghi:', error);
            showToast('error', 'Đã xảy ra lỗi khi lưu tiện nghi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 10. MỞ VÀ XÁC NHẬN XÓA (DELETE)
    const handleOpenDeleteModal = (item) => {
        setDeleteModal({
            isOpen: true,
            item,
            isDeleting: false
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.item) return;
        setDeleteModal(prev => ({ ...prev, isDeleting: true }));
        try {
            const res = await amenityService.deleteAmenity(deleteModal.item.id);
            if (res.success) {
                showToast('success', `Đã xóa tiện nghi "${deleteModal.item.name}" thành công!`);
                setDeleteModal({ isOpen: false, item: null, isDeleting: false });
                fetchAmenities();
            } else {
                showToast('error', res.message);
                setDeleteModal(prev => ({ ...prev, isDeleting: false }));
            }
        } catch (error) {
            console.error('Lỗi khi xóa tiện nghi:', error);
            showToast('error', 'Lỗi kết nối khi xóa tiện nghi.');
            setDeleteModal(prev => ({ ...prev, isDeleting: false }));
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-12">
            {/* TOAST THÔNG BÁO NỔI */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-slideInRight ${
                    toast.type === 'success'
                        ? 'bg-emerald-500/95 text-white border-emerald-400 shadow-emerald-500/20'
                        : 'bg-rose-500/95 text-white border-rose-400 shadow-rose-500/20'
                }`}>
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

            {/* HEADER: TIÊU ĐỀ "QUẢN LÝ TIỆN NGHI" VÀ NÚT "+ THÊM TIỆN NGHI" */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                                Quản Lý Tiện Nghi
                            </h1>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {amenities.length} tiện ích
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Quản lý danh sách các trang thiết bị, tiện ích phòng nghỉ để gắn vào từng Hạng phòng
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Nút Làm mới */}
                    <button
                        type="button"
                        onClick={fetchAmenities}
                        disabled={isLoading}
                        className="p-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>

                    {/* Nút "+ Thêm tiện nghi" ở góc phải */}
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span> Thêm tiện nghi</span>
                    </button>
                </div>
            </div>

            {/* THANH TÌM KIẾM & THỐNG KÊ NHANH */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm kiếm theo tên tiện nghi, mô tả hoặc ID..."
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

                <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>Hiển thị: <strong className="text-slate-800">{filteredAmenities.length}</strong> / {amenities.length} tiện nghi</span>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU (TABLE): ID, TÊN TIỆN NGHI, MÔ TẢ, ICON, HÀNH ĐỘNG */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-6 w-20 text-center">ID</th>
                                <th className="py-4 px-6 w-28 text-center">Icon</th>
                                <th className="py-4 px-6 min-w-[200px]">Tên tiện nghi</th>
                                <th className="py-4 px-6 min-w-[300px]">Mô tả (Description)</th>
                                <th className="py-4 px-6 w-36 text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-slate-400">
                                        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                        <p className="font-semibold text-slate-600 text-sm">Đang tải danh sách tiện nghi...</p>
                                    </td>
                                </tr>
                            ) : filteredAmenities.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-slate-400">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
                                            🔍
                                        </div>
                                        <p className="font-semibold text-slate-700 text-sm">Không tìm thấy tiện nghi nào</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {searchTerm ? 'Thử tìm với từ khóa khác' : 'Chưa có tiện nghi nào được tạo. Bấm "+ Thêm tiện nghi" để tạo mới!'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAmenities.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                                        {/* CỘT 1: ID */}
                                        <td className="py-4 px-6 text-center">
                                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                                #{item.id}
                                            </span>
                                        </td>

                                        {/* CỘT 2: ICON */}
                                        <td className="py-4 px-6 text-center">
                                            <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
                                                {item.icon || '✨'}
                                            </div>
                                        </td>

                                        {/* CỘT 3: TÊN TIỆN NGHI */}
                                        <td className="py-4 px-6">
                                            <strong className="text-slate-900 font-bold block text-sm group-hover:text-blue-600 transition-colors">
                                                {item.name}
                                            </strong>
                                        </td>

                                        {/* CỘT 4: MÔ TẢ (DESCRIPTION) */}
                                        <td className="py-4 px-6">
                                            {item.description ? (
                                                <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                                                    {item.description}
                                                </p>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">
                                                    Chưa có mô tả
                                                </span>
                                            )}
                                        </td>

                                        {/* CỘT 5: HÀNH ĐỘNG (NÚT SỬA MÀU VÀNG, NÚT XÓA MÀU ĐỎ) */}
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* Nút Sửa màu vàng */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(item)}
                                                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                    title="Chỉnh sửa tiện nghi"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                                    <span>Sửa</span>
                                                </button>

                                                {/* Nút Xóa màu đỏ */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDeleteModal(item)}
                                                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                    title="Xóa tiện nghi"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                                    <span>Xóa</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL FORM: THÊM MỚI HOẶC CẬP NHẬT TIỆN NGHI */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                    <div
                        className="fixed inset-0"
                        onClick={handleCloseModal}
                        aria-hidden="true"
                    />

                    <div
                        className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden z-10 animate-scaleUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100 shadow-xs">
                                    {modalMode === 'create' ? '✨' : '✏️'}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        {modalMode === 'create' ? 'Thêm Tiện Nghi Mới' : 'Cập Nhật Tiện Nghi'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {modalMode === 'create'
                                            ? 'Nhập thông tin trang bị, tiện ích phòng nghỉ mới'
                                            : `Chỉnh sửa tiện nghi #${editingItem?.id}`}
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

                        {/* Form Body */}
                        <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
                            {/* Input: Tên tiện nghi */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">
                                    Tên tiện nghi <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ví dụ: Wifi tốc độ cao, Smart TV 55 inch, Bồn tắm nằm..."
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs"
                                />
                            </div>

                            {/* Input: Icon (Hỗ trợ nhập Emoji hoặc chọn nhanh) */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">
                                    Biểu tượng (Icon / Emoji)
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                                        {formData.icon || '✨'}
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                        placeholder="Nhập Emoji (VD: 📶, 📺, ☕)..."
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs"
                                    />
                                </div>

                                {/* Bảng chọn nhanh Icon */}
                                <div className="pt-2">
                                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                                        Gợi ý chọn nhanh biểu tượng:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {SUGGESTED_ICONS.map((s, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, icon: s.icon })}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition cursor-pointer ${
                                                    formData.icon === s.icon
                                                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                                }`}
                                                title={s.label}
                                            >
                                                {s.icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Input: Mô tả (Description) */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">
                                    Mô tả tiện nghi (Description)
                                </label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ví dụ: Trang bị mạng cáp quang 300Mbps phủ sóng toàn bộ diện tích phòng..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs resize-none"
                                />
                            </div>

                            {/* Preview nhỏ */}
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                                    {formData.icon || '✨'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <strong className="text-slate-900 block truncate">
                                        {formData.name || 'Tên tiện nghi hiển thị'}
                                    </strong>
                                    <p className="text-[11px] text-slate-500 truncate">
                                        {formData.description || 'Mô tả chi tiết'}
                                    </p>
                                </div>
                            </div>

                            {/* Nút hành động Modal */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Đang lưu...</span>
                                        </>
                                    ) : (
                                        <span>{modalMode === 'create' ? 'Tạo tiện nghi' : 'Lưu thay đổi'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN XÓA (CONFIRM DELETE) */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                    <div
                        className="fixed inset-0"
                        onClick={() => !deleteModal.isDeleting && setDeleteModal({ isOpen: false, item: null, isDeleting: false })}
                        aria-hidden="true"
                    />

                    <div
                        className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 z-10 text-center animate-scaleUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 border border-rose-100 shadow-xs">
                            <Trash2 className="w-7 h-7" />
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                            Xác nhận xóa tiện nghi?
                        </h3>
                        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                            Bạn có chắc chắn muốn xóa tiện nghi <strong className="text-slate-800">&ldquo;{deleteModal.item?.name}&rdquo;</strong> (#{deleteModal.item?.id}) không? Hành động này sẽ gỡ tiện nghi ra khỏi danh mục tiện ích phòng.
                        </p>

                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                disabled={deleteModal.isDeleting}
                                onClick={() => setDeleteModal({ isOpen: false, item: null, isDeleting: false })}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={deleteModal.isDeleting}
                                onClick={handleConfirmDelete}
                                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                                {deleteModal.isDeleting ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Đang xóa...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Xác nhận xóa</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
