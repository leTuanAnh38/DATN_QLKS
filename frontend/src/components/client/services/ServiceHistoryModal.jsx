import React from 'react';
import {
    History,
    RotateCw,
    Trash2,
    X,
    Layers,
    Clock,
    Utensils,
    BellRing,
    CheckCircle2,
    XCircle,
    Receipt,
    BedDouble,
    Check,
    ChevronLeft,
    ChevronRight,
    PhoneCall
} from 'lucide-react';
import {
    renderCategoryIcon,
    formatDateTimeDisplay,
    getServiceLabels
} from './serviceHelpers';

export default function ServiceHistoryModal({
    isOpen = false,
    onClose,
    activeOrdersCount = 0,
    fetchOrderHistory = () => {},
    isLoadingHistory = false,
    isAuthenticated = false,
    handleClearGuestSession = () => {},
    historyFilter = 'all',
    setHistoryFilter = () => {},
    historyStats = {
        total: 0,
        pending: 0,
        inProgress: 0,
        delivering: 0,
        completed: 0,
        cancelled: 0
    },
    orderHistory = [],
    sortedHistory = [],
    paginatedHistory = [],
    totalHistoryPages = 1,
    historyPage = 1,
    setHistoryPage = () => {},
    cancellingRequestId = null,
    onCancelOrder = () => {}
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
            <div
                className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up z-10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-white text-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200/80 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl shrink-0 border border-amber-200/60 shadow-xs">
                            <History className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <span>Lịch Sử Đặt Món & Dịch Vụ Tại Phòng</span>
                                {activeOrdersCount > 0 && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase shadow-xs">
                                        {activeOrdersCount} đang xử lý
                                    </span>
                                )}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Theo dõi thời gian thực tiến độ tiếp nhận, chuẩn bị và phục vụ dịch vụ tận phòng của bạn.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fetchOrderHistory()}
                            disabled={isLoadingHistory}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Làm mới trạng thái"
                        >
                            <RotateCw
                                className={`w-3.5 h-3.5 ${
                                    isLoadingHistory ? 'animate-spin text-amber-600' : 'text-slate-600'
                                }`}
                            />
                            <span className="hidden sm:inline">Làm mới</span>
                        </button>
                        {!isAuthenticated && sessionStorage.getItem('pms_guest_booking_code') && (
                            <button
                                type="button"
                                onClick={handleClearGuestSession}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 transition cursor-pointer"
                                title="Xóa phiên lưu trữ mã phòng này trên thiết bị này"
                            >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span className="hidden sm:inline">Xóa phiên</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center cursor-pointer"
                            title="Đóng"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs - Ghim cố định dưới Header, chỉ cho phép cuộn ngang (X), khóa hoàn toàn cuộn dọc (Y) */}
                <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar shrink-0 touch-pan-x select-none">
                    {[
                        { key: 'all', label: 'Tất cả', icon: Layers, count: historyStats.total },
                        { key: 'pending', label: 'Chờ xác nhận', icon: Clock, count: historyStats.pending },
                        { key: 'in_progress', label: 'Đang chuẩn bị', icon: Utensils, count: historyStats.inProgress },
                        { key: 'delivering', label: 'Đang phục vụ', icon: BellRing, count: historyStats.delivering },
                        { key: 'completed', label: 'Hoàn thành', icon: CheckCircle2, count: historyStats.completed },
                        { key: 'cancelled', label: 'Đã hủy', icon: XCircle, count: historyStats.cancelled }
                    ].map((tab) => {
                        const IconComponent = tab.icon;
                        const isActive = historyFilter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setHistoryFilter(tab.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                                    isActive
                                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-sm ring-1 ring-sky-500'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                                }`}
                            >
                                <IconComponent
                                    className={`w-3.5 h-3.5 ${isActive ? 'text-amber-200' : 'text-slate-400'}`}
                                />
                                <span>{tab.label}</span>
                                <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Modal Body / Request List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {isLoadingHistory && orderHistory.length === 0 ? (
                        <div className="py-16 text-center space-y-3">
                            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="text-xs font-semibold text-slate-500">
                                Đang tải lịch sử dịch vụ...
                            </p>
                        </div>
                    ) : sortedHistory.length === 0 ? (
                        <div className="py-16 text-center space-y-3 max-w-sm mx-auto">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-inner">
                                <Receipt className="w-7 h-7 text-amber-600" />
                            </div>
                            <h4 className="font-serif text-base font-bold text-slate-900">
                                {historyFilter === 'all'
                                    ? 'Bạn chưa có yêu cầu dịch vụ nào'
                                    : `Không có yêu cầu nào ở mục "${
                                          historyFilter === 'pending'
                                              ? 'Chờ xác nhận'
                                              : historyFilter === 'in_progress'
                                              ? 'Đang chuẩn bị'
                                              : historyFilter === 'delivering'
                                              ? 'Đang phục vụ'
                                              : historyFilter === 'completed'
                                              ? 'Hoàn thành'
                                              : 'Đã hủy'
                                      }"`}
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Khám phá danh mục dịch vụ & ẩm thực phong phú của chúng tôi để được phục vụ chu đáo tận phòng nghỉ.
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-md shadow-sky-900/20 cursor-pointer"
                            >
                                Xem Menu ngay
                            </button>
                        </div>
                    ) : (
                        paginatedHistory.map((item) => {
                            const isPending = item.status === 'pending';
                            const isInProgress = item.status === 'in_progress';
                            const isDelivering = item.status === 'delivering';
                            const isCompleted = item.status === 'completed';
                            const isCancelled = item.status === 'cancelled';
                            const priceNum =
                                Number(item.total_price || item.service_price * item.quantity) || 0;
                            const labels = getServiceLabels(item.service_name, item.category_name);

                            // Xác định bước tiến trình (1: Tiếp nhận, 2: Chuẩn bị, 3: Đang giao, 4: Hoàn thành)
                            const currentStep = isCompleted ? 4 : isDelivering ? 3 : isInProgress ? 2 : 1;
                            const progressPercent = isCompleted ? 100 : isDelivering ? 68 : isInProgress ? 34 : 0;

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-200 hover:shadow-md transition overflow-hidden shadow-2xs"
                                >
                                    {/* Thẻ Header: Mã đơn + Phòng + Trạng thái */}
                                    <div className="bg-slate-50/80 px-4 sm:px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-slate-800">
                                                #SRQ-{item.id}
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 flex items-center gap-1.5 shadow-2xs">
                                                <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                                                Phòng {item.room_number || 'Lưu trú'}
                                            </span>
                                            {item.booking_code && (
                                                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                                                    (Mã #{item.booking_code})
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-400 hidden sm:inline flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {formatDateTimeDisplay(item.created_at || item.request_time)}
                                            </span>
                                            {/* Status Badge */}
                                            {isPending && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                    {labels.badgePending}
                                                </span>
                                            )}
                                            {isInProgress && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"></span>
                                                    {labels.badgeInProgress}
                                                </span>
                                            )}
                                            {isDelivering && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
                                                    {labels.badgeDelivering}
                                                </span>
                                            )}
                                            {isCompleted && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                    {labels.badgeCompleted}
                                                </span>
                                            )}
                                            {isCancelled && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                    Đã hủy
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Body thẻ: Dịch vụ + Chi tiết */}
                                    <div className="p-4 sm:p-5">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3.5 flex-1">
                                                {item.service_image ? (
                                                    <img
                                                        src={item.service_image}
                                                        alt={item.service_name}
                                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                                                        onError={(e) => {
                                                            e.target.src =
                                                                'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=200&q=80';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                                                        {renderCategoryIcon(
                                                            item.category_name,
                                                            item.category_icon,
                                                            'w-6 h-6 text-amber-600'
                                                        )}
                                                    </div>
                                                )}

                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-slate-900 text-sm">
                                                        {item.service_name}
                                                    </h4>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                                            {item.category_name || 'Dịch vụ phòng'}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="font-bold text-slate-900">
                                                            Số lượng: x{item.quantity}
                                                        </span>
                                                        {item.service_price && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-slate-400 text-[11px]">
                                                                    ({Number(item.service_price).toLocaleString('vi-VN')} đ/lần)
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    {item.is_scheduled && item.request_time && (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-300">
                                                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                            <span>Hẹn giao: {formatDateTimeDisplay(item.request_time)}</span>
                                                        </div>
                                                    )}
                                                    {item.note && (
                                                        <div className="text-[11px] text-amber-900 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/60 italic">
                                                            Ghi chú: "{item.note}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-left sm:text-right shrink-0">
                                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                                                    Thành tiền
                                                </span>
                                                <div className="text-base font-black text-rose-600">
                                                    {priceNum.toLocaleString('vi-VN')}{' '}
                                                    <span className="text-xs font-bold text-slate-500">VND</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 block">
                                                    (Tính vào hóa đơn phòng)
                                                </span>
                                            </div>
                                        </div>

                                        {/* THANH TIẾN ĐỘ TRẠNG THÁI XỬ LÝ (4 BƯỚC) */}
                                        <div className="mt-5 pt-4 border-t border-slate-100">
                                            {!isCancelled ? (
                                                <div className="space-y-3">
                                                    {/* Interactive Step Timeline */}
                                                    <div className="relative flex items-center justify-between px-2 pt-1 pb-1">
                                                        <div className="absolute top-4 left-6 right-6 h-1 bg-slate-100 rounded-full z-0" />
                                                        <div
                                                            className="absolute top-4 left-6 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-500 rounded-full z-0 transition-all duration-700 ease-out"
                                                            style={{
                                                                width: `calc(${progressPercent}% * (100% - 48px) / 100)`
                                                            }}
                                                        />

                                                        {[
                                                            { num: 1, label: labels.step1 },
                                                            { num: 2, label: labels.step2 },
                                                            { num: 3, label: labels.step3 },
                                                            { num: 4, label: labels.step4 }
                                                        ].map((step) => {
                                                            const isPassed = currentStep > step.num;
                                                            const isCurrent = currentStep === step.num;
                                                            return (
                                                                <div
                                                                    key={step.num}
                                                                    className="relative z-10 flex flex-col items-center"
                                                                >
                                                                    <div
                                                                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                                                                            isPassed
                                                                                ? 'bg-emerald-500 text-white shadow-xs ring-4 ring-emerald-50'
                                                                                : isCurrent
                                                                                ? isCompleted
                                                                                    ? 'bg-emerald-500 text-white shadow-md ring-4 ring-emerald-100'
                                                                                    : 'bg-amber-500 text-white shadow-md ring-4 ring-amber-100 scale-105 font-black'
                                                                                : 'bg-white text-slate-400 border-2 border-slate-200'
                                                                        }`}
                                                                    >
                                                                        {isPassed || (isCurrent && isCompleted) ? (
                                                                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                        ) : (
                                                                            <span>{step.num}</span>
                                                                        )}
                                                                    </div>
                                                                    <span
                                                                        className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold text-center whitespace-nowrap transition-colors ${
                                                                            isCurrent
                                                                                ? isCompleted
                                                                                    ? 'text-emerald-700 font-bold'
                                                                                    : 'text-amber-800 font-bold'
                                                                                : isPassed
                                                                                ? 'text-slate-700 font-medium'
                                                                                : 'text-slate-400'
                                                                        }`}
                                                                    >
                                                                        {step.label}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Thông báo trạng thái & nút Hủy */}
                                                    <div
                                                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                                                            isCompleted
                                                                ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                                                                : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                            ) : (
                                                                <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                                                            )}
                                                            <span className="font-medium text-[11px] sm:text-xs">
                                                                {isPending && labels.pendingMessage}
                                                                {isInProgress && labels.inProgressMessage}
                                                                {isDelivering && labels.deliveringMessage}
                                                                {isCompleted && labels.completedMessage}
                                                            </span>
                                                        </div>

                                                        {isPending && !item.is_paid && (
                                                            <button
                                                                type="button"
                                                                disabled={cancellingRequestId === item.id}
                                                                onClick={() => onCancelOrder(item)}
                                                                className="self-end sm:self-auto px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-100/60 border border-rose-200 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                <X className="w-3 h-3" />
                                                                <span>
                                                                    {cancellingRequestId === item.id
                                                                        ? 'Đang hủy...'
                                                                        : 'Hủy yêu cầu'}
                                                                </span>
                                                            </button>
                                                        )}
                                                        {isPending && item.is_paid && (
                                                            <span className="self-end sm:self-auto px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                                Đã thanh toán trước (Liên hệ Lễ tân nếu cần đổi/hủy)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50/80 p-3 rounded-xl border border-rose-200">
                                                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                                    <span>
                                                        Yêu cầu đã được hủy bỏ. Dịch vụ không thực hiện và không phát sinh bất kỳ chi phí nào.
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Phân trang lịch sử đơn đặt món */}
                {totalHistoryPages > 1 && (
                    <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0 select-none">
                        <div className="text-slate-500 font-medium text-[11px]">
                            Hiển thị trang <strong className="text-slate-800">{historyPage}</strong> / {totalHistoryPages} ({sortedHistory.length} đơn)
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={historyPage <= 1}
                                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                            >
                                <ChevronLeft className="w-3 h-3" />
                                <span>Trước</span>
                            </button>
                            {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setHistoryPage(p)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        historyPage === p
                                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-xs'
                                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                type="button"
                                disabled={historyPage >= totalHistoryPages}
                                onClick={() => setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                            >
                                <span>Sau</span>
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Footer */}
                <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
                    <div className="flex items-center gap-2 text-slate-600 text-[11px] sm:text-xs">
                        <PhoneCall className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                            Cần hỗ trợ khẩn cấp, vui lòng bấm phím <strong className="text-slate-900 font-black">0</strong> trên điện thoại bàn phòng.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 transition shadow-xs cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

