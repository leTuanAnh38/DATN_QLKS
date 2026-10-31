import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Zap } from 'lucide-react';
import { hotelService } from '../../../../services/hotelService';
import { bookingService } from '../../../../services/bookingService';

const formatToLocalDateTimeString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const QUICK_SURCHARGES = [
    "Nước ngọt / Bia Mini Bar",
    "Đền bù ly / đồ thủy tinh vỡ",
    "Phụ thu trả phòng muộn (Late Check-out)",
    "Phụ thu nhận phòng sớm (Early Check-in)",
    "Giặt ủi nhanh lấy ngay",
    "Phụ thu khách ở thêm (Extra Person)"
];

export default function AddServiceModal({
    isOpen,
    booking,
    onClose,
    onSuccess,
    showToast,
    initialCatalog = []
}) {
    const [serviceMode, setServiceMode] = useState('menu'); // 'menu' | 'custom'
    const [serviceCatalog, setServiceCatalog] = useState(initialCatalog);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [isSubmittingService, setIsSubmittingService] = useState(false);
    const [serviceSearchKeyword, setServiceSearchKeyword] = useState('');
    const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');
    const [serviceForm, setServiceForm] = useState({
        service_id: '',
        custom_name: '',
        quantity: 1,
        price: '',
        note: '',
        service_status: 'completed',
        is_scheduled: false,
        scheduled_time: ''
    });

    useEffect(() => {
        if (!isOpen) return;

        setServiceMode('menu');
        setServiceSearchKeyword('');
        setServiceCategoryFilter('all');
        setServiceForm({
            service_id: '',
            custom_name: '',
            quantity: 1,
            price: '',
            note: '',
            service_status: 'completed',
            is_scheduled: false,
            scheduled_time: ''
        });

        if (serviceCatalog.length === 0) {
            setIsLoadingCatalog(true);
            hotelService.getServiceItems({ status: 'active' })
                .then((res) => {
                    if (res && res.success && res.items) {
                        setServiceCatalog(res.items);
                    }
                })
                .catch((err) => {
                    console.error('Lỗi khi tải thực đơn dịch vụ:', err);
                })
                .finally(() => {
                    setIsLoadingCatalog(false);
                });
        }
    }, [isOpen]);

    const serviceCategories = useMemo(() => {
        const cats = new Map();
        serviceCatalog.forEach((item) => {
            if (item.category && item.category.name) {
                cats.set(item.category.id, item.category.name);
            } else if (item.category_name) {
                cats.set(item.category_id || item.category_name, item.category_name);
            }
        });
        return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
    }, [serviceCatalog]);

    const filteredCatalog = useMemo(() => {
        return serviceCatalog.filter((item) => {
            const catId = item.category?.id || item.category_id;
            const matchesCategory =
                serviceCategoryFilter === 'all' || String(catId) === String(serviceCategoryFilter);
            const matchesSearch =
                !serviceSearchKeyword.trim() ||
                (item.name || '').toLowerCase().includes(serviceSearchKeyword.toLowerCase().trim()) ||
                (item.category?.name || item.category_name || '').toLowerCase().includes(serviceSearchKeyword.toLowerCase().trim());
            return matchesCategory && matchesSearch;
        });
    }, [serviceCatalog, serviceCategoryFilter, serviceSearchKeyword]);

    const handleServiceSelect = (id) => {
        const item = serviceCatalog.find((s) => String(s.id) === String(id));
        setServiceForm((prev) => ({
            ...prev,
            service_id: id,
            price: item ? item.price : ''
        }));
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!booking) return;

        if (serviceMode === 'menu' && !serviceForm.service_id) {
            showToast?.('error', 'Vui lòng chọn một món hoặc dịch vụ từ thực đơn.');
            return;
        }

        if (serviceMode === 'custom' && !serviceForm.custom_name.trim()) {
            showToast?.('error', 'Vui lòng nhập tên dịch vụ hoặc phụ phí.');
            return;
        }

        if (serviceMode === 'custom' && (serviceForm.price === '' || Number(serviceForm.price) < 0)) {
            showToast?.('error', 'Vui lòng nhập đơn giá hợp lệ.');
            return;
        }

        if (serviceMode === 'menu' && serviceForm.service_status === 'pending' && serviceForm.is_scheduled && !serviceForm.scheduled_time) {
            showToast?.('error', 'Vui lòng chọn ngày và giờ hẹn giao món / dịch vụ.');
            return;
        }

        try {
            setIsSubmittingService(true);
            const payload = {
                quantity: Number(serviceForm.quantity) || 1,
                note: serviceForm.note.trim(),
                service_status: serviceForm.service_status
            };

            if (serviceMode === 'menu') {
                payload.service_id = serviceForm.service_id;
                if (serviceForm.price !== '') payload.price = Number(serviceForm.price);
                if (serviceForm.service_status === 'pending') {
                    payload.is_scheduled = !!serviceForm.is_scheduled;
                    if (serviceForm.is_scheduled && serviceForm.scheduled_time) {
                        payload.request_time = new Date(serviceForm.scheduled_time).toISOString();
                    }
                }
            } else {
                payload.custom_name = serviceForm.custom_name.trim();
                payload.price = Number(serviceForm.price);
            }

            const res = await bookingService.addExtraService(booking.id, payload);
            if (res && res.success && res.booking) {
                showToast?.('success', res.message || 'Thêm dịch vụ cho khách thành công!');
                onSuccess?.(res.booking);
                onClose?.();
            } else {
                showToast?.('error', res?.message || 'Không thể thêm dịch vụ. Vui lòng thử lại.');
            }
        } catch (error) {
            showToast?.('error', error.message || 'Lỗi kết nối khi thêm dịch vụ.');
        } finally {
            setIsSubmittingService(false);
        }
    };

    if (!isOpen || !booking) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header Modal - Cố định ở trên */}
                <div className="p-4 sm:p-5 bg-white border-b border-slate-100 text-slate-900 flex items-start justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center text-xl shrink-0 shadow-xs">
                            🛎️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                    #{booking.booking_code}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-xs text-slate-600 font-semibold">
                                    {booking.room_number ? `Phòng ${booking.room_number}` : booking.room_name}
                                </span>
                            </div>
                            <h3 className="font-serif text-lg font-bold text-slate-900 mt-1">
                                Thêm Dịch Vụ / Gọi Món Cho Khách
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Khách hàng: <strong className="text-slate-800 font-semibold">{booking.guest_name}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Thanh chuyển chế độ: Từ Menu vs Tùy Chỉnh - Cố định */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setServiceMode('menu')}
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${serviceMode === 'menu'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        <span>🍽️</span>
                        <span>Từ Menu Khách Sạn ({serviceCatalog.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setServiceMode('custom')}
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${serviceMode === 'custom'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        <span>✏️</span>
                        <span>Phụ Phí / Dịch Vụ Tùy Chỉnh</span>
                    </button>
                </div>

                {/* Form Body - Tách riêng phần cuộn và footer */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
                        {serviceMode === 'menu' ? (
                            <div className="space-y-4">
                                {/* Tìm kiếm và Lọc theo Danh mục */}
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={serviceSearchKeyword}
                                                onChange={(e) => setServiceSearchKeyword(e.target.value)}
                                                placeholder="Tìm kiếm món ăn, thức uống, spa..."
                                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                            />
                                            <span className="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
                                        </div>
                                        {serviceCategories.length > 0 && (
                                            <select
                                                value={serviceCategoryFilter}
                                                onChange={(e) => setServiceCategoryFilter(e.target.value)}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                            >
                                                <option value="all">Tất cả nhóm</option>
                                                {serviceCategories.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Dropdown / Danh sách chọn Dịch vụ */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                                        Chọn món hoặc dịch vụ <span className="text-rose-500">*</span>
                                    </label>
                                    {isLoadingCatalog ? (
                                        <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                            Đang tải danh mục thực đơn...
                                        </div>
                                    ) : filteredCatalog.length === 0 ? (
                                        <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                                            Không tìm thấy dịch vụ nào phù hợp với từ khóa.
                                        </div>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white shadow-inner">
                                            {filteredCatalog.map((item) => {
                                                const isSelected = String(serviceForm.service_id) === String(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleServiceSelect(item.id)}
                                                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition ${isSelected
                                                            ? 'bg-purple-50 text-purple-950 font-semibold'
                                                            : 'hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <input
                                                                type="radio"
                                                                name="service_selection"
                                                                checked={isSelected}
                                                                onChange={() => handleServiceSelect(item.id)}
                                                                className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                            />
                                                            <div className="truncate">
                                                                <span className="block truncate font-bold text-slate-900 text-xs">
                                                                    {item.name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 block truncate">
                                                                    {item.category?.name || item.category_name || 'Dịch vụ'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-purple-700 shrink-0 text-xs">
                                                            {Number(item.price).toLocaleString('vi-VN')} VND
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Gợi ý nhanh các khoản phụ thu */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Gợi ý nhanh phụ phí:
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_SURCHARGES.map((sug, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setServiceForm((prev) => ({ ...prev, custom_name: sug }))}
                                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 border border-slate-200 text-slate-600 text-[11px] font-medium transition cursor-pointer"
                                            >
                                                {sug}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tên dịch vụ tùy chỉnh */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1">
                                        Tên dịch vụ / Phụ phí tùy chỉnh <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={serviceForm.custom_name}
                                        onChange={(e) => setServiceForm((prev) => ({ ...prev, custom_name: e.target.value }))}
                                        placeholder="VD: 2 Lon nước ngọt Coca, Phụ thu check-in sớm..."
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                    />
                                </div>

                                {/* Đơn giá tùy chỉnh */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1">
                                        Đơn giá (VND) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="1000"
                                        value={serviceForm.price}
                                        onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                                        placeholder="VD: 40000"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Cụm Số lượng & Đơn giá xem trước */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1">
                                    Số lượng
                                </label>
                                <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                quantity: Math.max(1, (Number(prev.quantity) || 1) - 1)
                                            }))
                                        }
                                        className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-base flex items-center justify-center transition cursor-pointer"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={serviceForm.quantity}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                quantity: Math.max(1, parseInt(e.target.value) || 1)
                                            }))
                                        }
                                        className="flex-1 text-center font-bold text-slate-900 text-xs focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                quantity: (Number(prev.quantity) || 1) + 1
                                            }))
                                        }
                                        className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-base flex items-center justify-center transition cursor-pointer"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1">
                                    Đơn giá áp dụng (VND)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={serviceForm.price}
                                    onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                                    placeholder="0"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                />
                            </div>
                        </div>

                        {/* Tùy chọn trạng thái dịch vụ */}
                        {serviceMode === 'menu' && (
                            <div className="space-y-1.5 pt-1">
                                <label className="block text-xs font-bold text-slate-800">
                                    Trạng thái phục vụ:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition ${serviceForm.service_status === 'completed'
                                        ? 'bg-purple-50/80 border-purple-400 text-purple-950 font-semibold shadow-xs'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="service_status"
                                            value="completed"
                                            checked={serviceForm.service_status === 'completed'}
                                            onChange={() => setServiceForm((prev) => ({ ...prev, service_status: 'completed' }))}
                                            className="mt-0.5 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div>
                                            <span className="block text-xs font-bold text-slate-900">
                                                ✓ Đã phục vụ xong
                                            </span>
                                            <span className="text-[10px] text-slate-500 leading-tight block">
                                                Tính ngay vào hóa đơn thanh toán
                                            </span>
                                        </div>
                                    </label>

                                    <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition ${serviceForm.service_status === 'pending'
                                        ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-semibold shadow-xs'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="service_status"
                                            value="pending"
                                            checked={serviceForm.service_status === 'pending'}
                                            onChange={() => setServiceForm((prev) => ({ ...prev, service_status: 'pending' }))}
                                            className="mt-0.5 text-amber-600 focus:ring-amber-500"
                                        />
                                        <div>
                                            <span className="block text-xs font-bold text-slate-900">
                                                ⏳ Chờ chuẩn bị
                                            </span>
                                            <span className="text-[10px] text-slate-500 leading-tight block">
                                                Chuyển bếp / buồng phòng làm
                                            </span>
                                        </div>
                                    </label>
                                </div>

                                {/* Tùy chọn Hẹn giờ giao khi trạng thái là Chờ chuẩn bị */}
                                {serviceForm.service_status === 'pending' && (
                                    <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2.5 mt-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                Thời gian phục vụ món
                                            </span>
                                            {serviceForm.is_scheduled && serviceForm.scheduled_time && (
                                                <span className="text-[11px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded-lg border border-amber-300">
                                                    Hẹn giao: {new Date(serviceForm.scheduled_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(serviceForm.scheduled_time).toLocaleDateString('vi-VN')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setServiceForm((prev) => ({ ...prev, is_scheduled: false, scheduled_time: '' }))}
                                                className={`p-2 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                                    !serviceForm.is_scheduled
                                                        ? 'bg-white border-amber-500 text-amber-900 font-bold ring-1 ring-amber-400'
                                                        : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white'
                                                }`}
                                            >
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                    !serviceForm.is_scheduled ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    <Zap className="w-3 h-3" />
                                                </div>
                                                <div className="text-[11px] font-bold">Giao ngay</div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const d = new Date(Date.now() + 30 * 60 * 1000);
                                                    setServiceForm((prev) => ({
                                                        ...prev,
                                                        is_scheduled: true,
                                                        scheduled_time: prev.scheduled_time || formatToLocalDateTimeString(d)
                                                    }));
                                                }}
                                                className={`p-2 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                                    serviceForm.is_scheduled
                                                        ? 'bg-white border-amber-500 text-amber-900 font-bold ring-1 ring-amber-400'
                                                        : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white'
                                                }`}
                                            >
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                    serviceForm.is_scheduled ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    <Clock className="w-3 h-3" />
                                                </div>
                                                <div className="text-[11px] font-bold">Hẹn giờ giao</div>
                                            </button>
                                        </div>

                                        {serviceForm.is_scheduled && (
                                            <div className="space-y-2 pt-1 border-t border-amber-200/60">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[10px] text-amber-800 font-semibold">Chọn nhanh:</span>
                                                    {[
                                                        { label: '+15 phút', mins: 15 },
                                                        { label: '+30 phút', mins: 30 },
                                                        { label: '+45 phút', mins: 45 },
                                                        { label: '+1 giờ', mins: 60 },
                                                        { label: '+2 giờ', mins: 120 }
                                                    ].map((chip) => (
                                                        <button
                                                            key={chip.label}
                                                            type="button"
                                                            onClick={() => {
                                                                const d = new Date(Date.now() + chip.mins * 60 * 1000);
                                                                setServiceForm((prev) => ({
                                                                    ...prev,
                                                                    scheduled_time: formatToLocalDateTimeString(d)
                                                                }));
                                                            }}
                                                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-semibold transition cursor-pointer"
                                                        >
                                                            {chip.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] font-bold text-amber-900 shrink-0">
                                                        Thời điểm hẹn:
                                                    </label>
                                                    <input
                                                        type="datetime-local"
                                                        value={serviceForm.scheduled_time}
                                                        min={formatToLocalDateTimeString(new Date())}
                                                        onChange={(e) => setServiceForm((prev) => ({ ...prev, scheduled_time: e.target.value }))}
                                                        className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Ghi chú phục vụ */}
                        <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">
                                Ghi chú tiếp nhận (tùy chọn)
                            </label>
                            <input
                                type="text"
                                value={serviceForm.note}
                                onChange={(e) => setServiceForm((prev) => ({ ...prev, note: e.target.value }))}
                                placeholder="VD: Khách gọi hotline lúc 11:20, giao tận phòng 304, ít cay..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                            />
                        </div>

                        {/* Banner Xem Trước Tổng Tiền */}
                        <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                                    Thành tiền phụ phí dự kiến
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    {serviceForm.quantity || 1} x {Number(serviceForm.price || 0).toLocaleString('vi-VN')} VND
                                </span>
                            </div>
                            <div className="text-right">
                                <strong className="text-lg font-black text-purple-900">
                                    {Number((serviceForm.quantity || 1) * (serviceForm.price || 0)).toLocaleString('vi-VN')}
                                </strong>
                                <span className="text-xs font-bold text-purple-700 ml-1">VND</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer nút hành động - Cố định ở dưới */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                        <button
                            type="button"
                            disabled={isSubmittingService}
                            onClick={onClose}
                            className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmittingService}
                            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                            {isSubmittingService ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <span className="font-bold">+</span>
                                    <span>Xác nhận thêm dịch vụ</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
