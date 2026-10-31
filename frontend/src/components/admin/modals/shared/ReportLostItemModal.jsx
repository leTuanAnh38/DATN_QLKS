import React, { useState, useEffect } from 'react';
import {
    Luggage,
    X,
    AlertTriangle,
    Camera,
    Bell,
    Loader2,
    Check
} from 'lucide-react';
import roomService from '../../../../services/roomService';

export default function ReportLostItemModal({ isOpen, onClose, room, initialData = {}, onSuccess }) {
    const [itemName, setItemName] = useState('');
    const [category, setCategory] = useState('electronics');
    const [locationFound, setLocationFound] = useState('');
    const [storageLocation, setStorageLocation] = useState('Két an toàn Lễ tân');
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const booking = room?.current_booking || room?.recent_booking || null;

    useEffect(() => {
        if (isOpen) {
            setItemName(initialData.item_name || '');
            setCategory(initialData.category || 'electronics');
            setLocationFound(initialData.location_found || (room ? `Phòng ${room.room_number}` : ''));
            setStorageLocation(initialData.storage_location || 'Két an toàn Lễ tân');
            setGuestName(initialData.guest_name || booking?.guest_name || '');
            setGuestPhone(initialData.guest_phone || booking?.guest_phone || '');
            setDescription(initialData.description || '');
            setImageFile(null);
            setImagePreview(null);
            setErrorMessage('');
        }
    }, [isOpen, room?.id]);

    if (!isOpen) return null;

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
        }
    };

    const categories = [
        { key: 'electronics', label: 'Thiết bị điện tử (Điện thoại, Laptop, Tai nghe, Sạc)' },
        { key: 'valuable', label: 'Đồ giá trị (Tiền mặt, Trang sức, Đồng hồ)' },
        { key: 'documents', label: 'Giấy tờ tùy thân (Hộ chiếu, CCCD, Ví tiền)' },
        { key: 'clothing', label: 'Quần áo / Giày dép / Túi xách' },
        { key: 'accessories', label: 'Phụ kiện / Kính mắt / Mỹ phẩm' },
        { key: 'other', label: 'Khác' },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!itemName.trim()) {
            setErrorMessage('Vui lòng nhập tên đồ vật nhặt được.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const formData = new FormData();
            if (room?.id) formData.append('room_id', room.id);
            formData.append('item_name', itemName.trim());
            formData.append('category', category);
            formData.append('location_found', locationFound.trim() || (room ? `Phòng ${room.room_number}` : 'Khu vực khách sạn'));
            formData.append('storage_location', storageLocation.trim() || 'Két an toàn Lễ tân');
            formData.append('guest_name', guestName.trim());
            formData.append('guest_phone', guestPhone.trim());
            formData.append('description', description.trim());
            if (imageFile) {
                formData.append('image', imageFile);
            }

            const res = await roomService.createLostAndFoundItem(formData);
            if (res && res.success) {
                if (onSuccess) {
                    onSuccess(res);
                }
                onClose();
            } else {
                setErrorMessage(res?.message || 'Không thể lưu thông tin đồ thất lạc.');
            }
        } catch (error) {
            setErrorMessage('Đã xảy ra lỗi khi gửi dữ liệu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div
                className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0 shadow-2xs">
                            <Luggage className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm sm:text-base text-slate-900">Báo Đồ Khách Thất Lạc</h3>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                                {room ? `Ghi nhận đồ bỏ quên tại Phòng ${room.room_number}` : 'Tiếp nhận tài sản thất lạc tại khách sạn'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Tên vật phẩm */}
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Tên vật phẩm nhặt được <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            placeholder="VD: Ví da nam Montblanc, Đồng hồ Apple Watch, Củ sạc iPhone 20W..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Phân loại */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                                Phân loại tài sản
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {categories.map((c) => (
                                    <option key={c.key} value={c.key}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Vị trí tìm thấy */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                                Vị trí tìm thấy
                            </label>
                            <input
                                type="text"
                                value={locationFound}
                                onChange={(e) => setLocationFound(e.target.value)}
                                placeholder="VD: Phòng 302 - Ngăn kéo tủ quần áo"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Thông tin khách (nếu có) */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                                Tên khách liên quan (nếu biết)
                            </label>
                            <input
                                type="text"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="Họ tên khách"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                                Số điện thoại khách
                            </label>
                            <input
                                type="text"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                placeholder="0901234567"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Nơi cất giữ / Lưu kho */}
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Nơi lưu kho bảo quản
                        </label>
                        <select
                            value={storageLocation}
                            onChange={(e) => setStorageLocation(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Két an toàn Lễ tân">Két an toàn Lễ tân</option>
                            <option value="Kho Buồng phòng tầng 1">Kho Buồng phòng tầng 1</option>
                            <option value="Tủ Lost & Found sảnh chính">Tủ Lost & Found sảnh chính</option>
                            <option value="Phòng Bảo vệ an ninh">Phòng Bảo vệ an ninh</option>
                        </select>
                    </div>

                    {/* Mô tả chi tiết */}
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Đặc điểm nhận dạng / Mô tả chi tiết
                        </label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Màu sắc, kích thước, vết trầy xước, ốp lưng, tình trạng pin..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Ảnh chụp đồ vật */}
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Ảnh chụp đồ vật (nếu có):
                        </label>
                        <div className="flex items-center gap-3">
                            <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5 transition">
                                <Camera className="w-4 h-4 text-slate-600" />
                                <span>{imageFile ? 'Đổi ảnh chụp' : 'Chụp / Chọn ảnh'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </label>

                            {imagePreview && (
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImageFile(null);
                                            setImagePreview(null);
                                        }}
                                        className="absolute top-0 right-0 w-4 h-4 bg-rose-600 text-white flex items-center justify-center rounded-bl cursor-pointer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            {imageFile && (
                                <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                    {imageFile.name}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Notification info */}
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 flex items-start gap-2">
                        <Bell className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                            <strong>Thông báo tự động:</strong> Khi gửi phiếu, hệ thống sẽ tự động thông báo đến bộ phận <strong>Lễ tân & Quản lý</strong> để đối soát với khách hàng và hỗ trợ khách nhận lại đồ sớm nhất.
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-xl transition cursor-pointer text-center"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-center"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Lập phiếu lưu kho & Báo Lễ tân</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
