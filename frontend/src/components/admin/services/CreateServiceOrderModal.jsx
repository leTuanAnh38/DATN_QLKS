import React, { useState, useEffect, useMemo } from 'react';
import {
    UtensilsCrossed,
    X,
    AlertTriangle,
    Search,
    CheckCircle2,
    Zap,
    Clock,
    ArrowRight
} from 'lucide-react';
import hotelService from '../../../services/hotelService';
import { formatCurrency } from '../../../utils/formatters';

const formatToLocalDateTimeString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function CreateServiceOrderModal({
    isOpen,
    onClose,
    onSuccess,
}) {
    const [isLoadingModalData, setIsLoadingModalData] = useState(false);
    const [modalSubmitting, setModalSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    const [activeBookings, setActiveBookings] = useState([]);
    const [serviceCatalog, setServiceCatalog] = useState([]);

    const [selectedBookingId, setSelectedBookingId] = useState('');
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [orderQuantity, setOrderQuantity] = useState(1);
    const [orderNote, setOrderNote] = useState('');
    const [modalServiceSearch, setModalServiceSearch] = useState('');
    const [modalCategoryFilter, setModalCategoryFilter] = useState('all');

    const [deliveryMode, setDeliveryMode] = useState('now'); // 'now' | 'scheduled'
    const [scheduledDateTime, setScheduledDateTime] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const loadData = async () => {
            setModalError('');
            setSelectedBookingId('');
            setSelectedServiceId('');
            setOrderQuantity(1);
            setOrderNote('');
            setModalServiceSearch('');
            setModalCategoryFilter('all');
            setDeliveryMode('now');
            setScheduledDateTime('');
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

        loadData();
    }, [isOpen]);

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
                cats.set(String(item.category.id), item.category.name);
            } else if (item.category_name) {
                cats.set(item.category_name, item.category_name);
            }
        });
        return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
    }, [serviceCatalog]);

    const handleSubmit = async (e) => {
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
        if (deliveryMode === 'scheduled' && !scheduledDateTime) {
            setModalError('Vui lòng chọn ngày và giờ hẹn giao món / dịch vụ.');
            return;
        }

        setModalSubmitting(true);
        try {
            const isScheduled = deliveryMode === 'scheduled';
            const payload = {
                booking_id: Number(selectedBookingId),
                service_id: Number(selectedServiceId),
                quantity: Number(orderQuantity),
                note: orderNote.trim(),
                is_scheduled: isScheduled,
                ...(isScheduled && scheduledDateTime ? { request_time: new Date(scheduledDateTime).toISOString() } : {})
            };
            const res = await hotelService.createServiceRequest(payload);
            if (res && res.success) {
                const bk = activeBookings.find((b) => String(b.id) === String(selectedBookingId));
                const srv = serviceCatalog.find((s) => String(s.id) === String(selectedServiceId));
                onSuccess && onSuccess(`Đã tạo yêu cầu "${srv?.name || 'món'}" cho Phòng ${bk?.room_number || ''} thành công!`);
                onClose();
            } else {
                setModalError(res?.message || 'Không thể tạo yêu cầu dịch vụ.');
            }
        } catch (err) {
            setModalError(err.message || 'Lỗi khi kết nối máy chủ.');
        } finally {
            setModalSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => !modalSubmitting && onClose()}
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
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
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

                                    {/* Danh sách các món */}
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
                                                            {formatCurrency(srv.price || 0)}
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
                                            {formatCurrency((modalSelectedService?.price || 0) * (orderQuantity || 1))}
                                        </strong>
                                        <span className="text-[10px] text-blue-500 mt-0.5">
                                            * Tự động cộng vào hóa đơn phòng khi hoàn tất
                                        </span>
                                    </div>
                                </div>

                                {/* Bước 4: Thời gian phục vụ */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                                        <span>4. Thời gian phục vụ</span>
                                        {deliveryMode === 'scheduled' && scheduledDateTime && (
                                            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                                                Hẹn giao: {new Date(scheduledDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(scheduledDateTime).toLocaleDateString('vi-VN')}
                                            </span>
                                        )}
                                    </label>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeliveryMode('now');
                                                setScheduledDateTime('');
                                            }}
                                            className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                                deliveryMode === 'now'
                                                    ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-bold ring-1 ring-blue-300'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                deliveryMode === 'now' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                <Zap className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-tight">Giao ngay</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Bếp / buồng phòng làm luôn</div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeliveryMode('scheduled');
                                                if (!scheduledDateTime) {
                                                    const d = new Date(Date.now() + 30 * 60 * 1000);
                                                    setScheduledDateTime(formatToLocalDateTimeString(d));
                                                }
                                            }}
                                            className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                                deliveryMode === 'scheduled'
                                                    ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-bold ring-1 ring-blue-300'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                deliveryMode === 'scheduled' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                <Clock className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-tight">Hẹn giờ giao</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Khách đặt trước giờ ăn / nhận phòng</div>
                                            </div>
                                        </button>
                                    </div>

                                    {deliveryMode === 'scheduled' && (
                                        <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2.5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[10px] text-slate-500 font-semibold">Chọn nhanh:</span>
                                                {[
                                                    { label: '+15 phút', mins: 15 },
                                                    { label: '+30 phút', mins: 30 },
                                                    { label: '+45 phút', mins: 45 },
                                                    { label: '+1 giờ', mins: 60 },
                                                    { label: '+2 giờ', mins: 120 }
                                                ].map((item) => (
                                                    <button
                                                        key={item.label}
                                                        type="button"
                                                        onClick={() => {
                                                            const d = new Date(Date.now() + item.mins * 60 * 1000);
                                                            setScheduledDateTime(formatToLocalDateTimeString(d));
                                                        }}
                                                        className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition cursor-pointer"
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <label className="text-[11px] font-bold text-slate-700 shrink-0">
                                                    Thời điểm hẹn giao:
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={scheduledDateTime}
                                                    min={formatToLocalDateTimeString(new Date())}
                                                    onChange={(e) => setScheduledDateTime(e.target.value)}
                                                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <p className="text-[10px] text-blue-700/80 italic">
                                                * Đơn hẹn giờ sẽ được ưu tiên xếp vào danh sách Chờ và chỉ bắt đầu tính thời hạn SLA chuẩn sau thời điểm hẹn.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Bước 5: Ghi chú đặc biệt của khách */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-800">
                                        5. Yêu cầu đặc biệt của khách (Ghi chú bếp / phục vụ)
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
                            onClick={onClose}
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
    );
}

