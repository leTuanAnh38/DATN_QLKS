import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2 } from 'lucide-react';
import { ROOM_STATUSES } from '../../../utils/constants';
import { formatCurrency } from '../../../utils/formatters';

export default function RoomFormModal({
    isOpen,
    onClose,
    mode = 'create', // 'create' | 'edit'
    initialData = null,
    categories = [],
    onSubmit,
    isSubmitting = false,
    onDelete,
    canDeleteRoom = false,
    isManagerOrAdmin = false
}) {
    const isEdit = mode === 'edit';

    const [formData, setFormData] = useState({
        room_number: '',
        floor: 1,
        category_id: '',
        status: 'available'
    });

    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                room_number: initialData.room_number || '',
                floor: Number(initialData.floor) || 1,
                category_id: initialData.category_id ? String(initialData.category_id) : (categories[0]?.id ? String(categories[0].id) : ''),
                status: initialData.status || 'available'
            });
        } else if (isOpen && !isEdit) {
            setFormData({
                room_number: '',
                floor: 1,
                category_id: categories[0]?.id ? String(categories[0].id) : '',
                status: 'available'
            });
        }
    }, [isOpen, initialData, isEdit, categories]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSubmit) {
            onSubmit(formData);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
                                isEdit
                                    ? 'bg-amber-50 border border-amber-200 text-amber-600'
                                    : 'bg-blue-50 border border-blue-200 text-blue-600 text-xl'
                            }`}
                        >
                            {isEdit ? <Edit3 className="w-5 h-5" /> : '＋'}
                        </div>
                        <div>
                            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                {isEdit ? `Chỉnh Sửa Thông Tin Phòng ${initialData?.room_number || ''}` : 'Thêm Phòng Mới Vào Sơ Đồ'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {isEdit
                                    ? 'Cập nhật số phòng, tầng hoặc hạng phòng trong sơ đồ'
                                    : 'Khởi tạo số phòng, phân loại tầng và gắn hạng phòng tương ứng'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
                    {/* Số phòng & Tầng */}
                    <div className="grid grid-cols-2 gap-3.5">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Số phòng thực tế <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Ví dụ: 101, 204, 502"
                                value={formData.room_number}
                                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-sm"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Mỗi số phòng là duy nhất</span>
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Vị trí Tầng <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={formData.floor}
                                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-xs"
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20].map((fl) => (
                                    <option key={fl} value={fl}>
                                        Tầng {fl}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Hạng phòng */}
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">
                            Hạng phòng (Room Category) <span className="text-rose-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.category_id}
                            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-xs"
                        >
                            <option value="" disabled>-- Chọn loại phòng --</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({formatCurrency(c.base_price)}/đêm - {c.bed_type})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Trạng thái phòng */}
                    <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                            {isEdit ? 'Trạng thái phòng' : 'Trạng thái ban đầu'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(ROOM_STATUSES).map((st) => (
                                <label
                                    key={st.key}
                                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                                        formData.status === st.key
                                            ? `${st.badgeClass} ring-2 ring-blue-500/20 font-bold`
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name={isEdit ? 'edit_status' : 'create_status'}
                                        value={st.key}
                                        checked={formData.status === st.key}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="hidden"
                                    />
                                    <span className={`w-2.5 h-2.5 rounded-full ${st.indicatorColor}`} />
                                    <span className="text-xs truncate">{st.shortLabel}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className={`pt-4 border-t border-slate-100 flex items-center ${isEdit ? 'justify-between' : 'justify-end gap-3'}`}>
                        {isEdit && canDeleteRoom && isManagerOrAdmin ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    if (onDelete) onDelete();
                                }}
                                className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> <span>Xóa phòng này</span>
                            </button>
                        ) : isEdit ? <div /> : null}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting
                                    ? (isEdit ? 'Đang lưu...' : 'Đang tạo phòng...')
                                    : (isEdit ? 'Lưu Thay Đổi' : 'Tạo Phòng Mới')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

