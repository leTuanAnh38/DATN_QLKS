import React, { useState, useEffect, useCallback } from 'react';
import {
    Building2,
    Plus,
    Search,
    RotateCw,
    X,
    Filter,
    Phone,
    Mail,
    MapPin,
    Tag,
    Percent,
    Clock,
    FileText,
    CheckCircle2,
    XCircle,
    Edit2,
    Trash2,
    Eye,
    TrendingUp,
    Users,
    AlertTriangle,
    Check,
    Layers,
    DollarSign,
    Lock,
    Unlock,
    CalendarCheck,
    Calendar,
    BedDouble
} from 'lucide-react';
import { bookingService } from '../../../services/bookingService';
import { useAuth } from '../../../store/authStore';
import { useHasPermission } from '../../../utils/permission';
import CorporatePartnerModal from '../../../components/admin/modals/shared/CorporatePartnerModal';
import CorporatePartnerHistoryModal from '../../../components/admin/modals/shared/CorporatePartnerHistoryModal';
import Pagination from '../../../components/common/Pagination';

export default function CorporatePartnerManagement() {
    const { user } = useAuth();

    // Phân quyền RBAC chuẩn hóa theo phân hệ 'corporate_partners' (B2B)
    const canRead = useHasPermission('corporate_partners', 'read');
    const canCreate = useHasPermission('corporate_partners', 'create');
    const canUpdate = useHasPermission('corporate_partners', 'update');
    const canDelete = useHasPermission('corporate_partners', 'delete');

    // States
    const [partners, setPartners] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedPartnerForEdit, setSelectedPartnerForEdit] = useState(null);
    const [detailPartner, setDetailPartner] = useState(null);
    const [deletePartner, setDeletePartner] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [statusModalPartner, setStatusModalPartner] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Modal Lịch sử đơn đặt của đối tác (Tách riêng component CorporatePartnerHistoryModal)
    const [historyPartner, setHistoryPartner] = useState(null);

    const showToast = (message, type = 'success') => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Mở modal xem lịch sử đơn đặt đoàn của đối tác
    const handleOpenHistory = (partner) => {
        setHistoryPartner(partner);
    };

    // Tải danh sách đối tác từ API
    const fetchPartners = useCallback(async () => {
        setIsLoading(true);
        const params = {};
        if (searchQuery.trim()) {
            params.search = searchQuery.trim();
        }
        if (statusFilter === 'active') {
            params.active_only = true;
        }

        const res = await bookingService.getCorporatePartners(params);
        if (res.success) {
            let list = res.data || [];
            // Lọc phía client nếu chọn 'inactive'
            if (statusFilter === 'inactive') {
                list = list.filter(p => !p.is_active);
            }
            setPartners(list);
        } else {
            showToast(res.message || 'Không thể tải danh sách đối tác', 'error');
        }
        setIsLoading(false);
    }, [searchQuery, statusFilter]);

    useEffect(() => {
        fetchPartners();
    }, [fetchPartners]);

    // Thống kê nhanh KPI
    const totalPartners = partners.length;
    const activePartners = partners.filter(p => p.is_active).length;
    const avgDiscount = totalPartners > 0
        ? (partners.reduce((sum, p) => sum + (parseFloat(p.discount_percent) || 0), 0) / totalPartners).toFixed(1)
        : 0;
    const totalRevenueB2B = partners.reduce((sum, p) => sum + (parseFloat(p.total_spent) || 0), 0);

    // Mở modal xác nhận thay đổi trạng thái
    const handleOpenStatusModal = (partner) => {
        if (!canUpdate) {
            showToast('Bạn không có quyền thay đổi trạng thái đối tác.', 'error');
            return;
        }
        setStatusModalPartner(partner);
    };

    // Xác nhận bật/tắt kích hoạt trạng thái (Toggle Active)
    const handleConfirmToggleStatus = async () => {
        if (!statusModalPartner) return;
        setIsUpdatingStatus(true);
        const res = await bookingService.toggleCorporatePartnerStatus(statusModalPartner.id);
        setIsUpdatingStatus(false);
        if (res.success) {
            showToast(res.message);
            setPartners(prev => prev.map(p => p.id === statusModalPartner.id ? { ...p, is_active: !p.is_active } : p));
            setStatusModalPartner(null);
        } else {
            showToast(res.message, 'error');
        }
    };

    // Xử lý xóa đối tác
    const handleConfirmDelete = async () => {
        if (!deletePartner) return;
        setIsDeleting(true);
        const res = await bookingService.deleteCorporatePartner(deletePartner.id);
        setIsDeleting(false);
        setDeletePartner(null);
        if (res.success) {
            showToast(res.message || 'Xóa đối tác thành công!');
            setPartners(prev => prev.filter(p => p.id !== deletePartner.id));
        } else {
            showToast(res.message, 'error');
        }
    };

    // Phân trang danh sách hiển thị
    const totalPages = Math.ceil(partners.length / pageSize) || 1;
    const paginatedPartners = partners.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    if (!canRead) {
        return (
            <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-2xl shadow-sm border border-slate-100 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Truy cập bị từ chối</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                    Tài khoản của bạn không có quyền xem thông tin phân hệ <span className="font-semibold text-slate-700">Đối tác Doanh nghiệp (B2B)</span>. Vui lòng liên hệ Quản lý (Manager) hoặc Quản trị viên (Admin) để được cấp quyền.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* TOAST THÔNG BÁO NHANH - Luôn nổi lên trên cùng (z-[99999]) */}
            {toastMessage && (
                <div className={`fixed top-5 right-5 z-[99999] max-w-lg px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold flex items-start gap-3 animate-fadeIn ${
                    toastMessage.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-500/10'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-500/10'
                }`}>
                    {toastMessage.type === 'error' ? (
                        <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                    ) : (
                        <Check className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                    )}
                    <span className="leading-relaxed flex-1">{toastMessage.message}</span>
                    <button
                        type="button"
                        onClick={() => setToastMessage(null)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 transition cursor-pointer"
                        title="Đóng thông báo"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* HEADER TIÊU ĐỀ & HÀNH ĐỘNG */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shadow-xs">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                                Đối tác Doanh nghiệp (B2B)
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                Corporate Partners
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Quản lý hồ sơ công ty, hợp đồng lưu trú đoàn M.I.C.E, biểu phí chiết khấu & hạn mức công nợ
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={fetchPartners}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>

                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedPartnerForEdit(null);
                                setIsFormModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Thêm đối tác mới</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 4 THẺ THỐNG KÊ NHANH (KPI METRICS) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tổng đối tác</p>
                        <h4 className="text-2xl font-black text-slate-900 mt-1">{totalPartners}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Doanh nghiệp đã ký kết</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Đang hợp tác</p>
                        <h4 className="text-2xl font-black text-emerald-600 mt-1">{activePartners}</h4>
                        <p className="text-[11px] text-emerald-700 mt-0.5">Hiệu lực đặt phòng</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chiết khấu TB</p>
                        <h4 className="text-2xl font-black text-amber-600 mt-1">{avgDiscount}%</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Ưu đãi hợp đồng B2B</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Percent className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tổng doanh thu B2B</p>
                        <h4 className="text-lg sm:text-xl font-black text-indigo-700 mt-1">
                            {new Intl.NumberFormat('vi-VN').format(totalRevenueB2B)} <span className="text-xs font-normal">đ</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Từ các đơn đoàn & hội nghị</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* BỘ LỌC & TÌM KIẾM */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Ô tìm kiếm */}
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Tìm theo tên công ty, MST, mã B2B, đại diện..."
                        className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setCurrentPage(1);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filter Trạng thái */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                statusFilter === 'all'
                                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Tất cả ({totalPartners})
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStatusFilter('active'); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                statusFilter === 'active'
                                    ? 'bg-white text-emerald-600 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Đang hợp tác ({activePartners})
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStatusFilter('inactive'); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                statusFilter === 'inactive'
                                    ? 'bg-white text-slate-800 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Tạm ngưng ({totalPartners - activePartners})
                        </button>
                    </div>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU ĐỐI TÁC */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3.5">Doanh nghiệp / Pháp lý</th>
                                <th className="px-4 py-3.5">Mã B2B & Ưu đãi</th>
                                <th className="px-4 py-3.5">Người đại diện liên hệ</th>
                                <th className="px-4 py-3.5">Hợp đồng & Công nợ</th>
                                <th className="px-4 py-3.5 text-center">Đoàn đã đặt</th>
                                <th className="px-4 py-3.5 text-center">Trạng thái</th>
                                <th className="px-5 py-3.5 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                            <span className="text-xs">Đang tải danh bạ đối tác doanh nghiệp...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedPartners.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                        <p className="font-semibold text-slate-600">Không tìm thấy đối tác doanh nghiệp nào</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {searchQuery ? 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.' : 'Hãy bấm "Thêm đối tác mới" để tạo hồ sơ doanh nghiệp đầu tiên.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedPartners.map((partner) => (
                                    <tr key={partner.id} className="hover:bg-slate-50/70 transition group">
                                        {/* Cột 1: Thông tin công ty */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0 mt-0.5">
                                                    {partner.company_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition flex items-center gap-1.5">
                                                        <span className="truncate max-w-[220px]">{partner.company_name}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                        MST: <span className="font-semibold text-slate-700">{partner.tax_code}</span>
                                                    </div>
                                                    {partner.company_address && (
                                                        <div className="text-[11px] text-slate-400 truncate max-w-[240px] mt-0.5 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            <span>{partner.company_address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cột 2: Mã B2B & Chiết khấu */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    {partner.corporate_code}
                                                </span>
                                                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                                    <Percent className="w-3 h-3" />
                                                    <span>Giảm {partner.discount_percent}%</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cột 3: Người đại diện */}
                                        <td className="px-4 py-3.5">
                                            <div className="text-xs">
                                                <p className="font-bold text-slate-900">{partner.contact_person}</p>
                                                <p className="text-slate-500 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                    <span>{partner.contact_phone}</span>
                                                </p>
                                                {partner.contact_email && (
                                                    <p className="text-slate-400 text-[11px] truncate max-w-[180px] flex items-center gap-1 mt-0.5">
                                                        <Mail className="w-3 h-3 text-slate-400" />
                                                        <span>{partner.contact_email}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </td>

                                        {/* Cột 4: Hợp đồng & Công nợ */}
                                        <td className="px-4 py-3.5">
                                            <div className="text-xs space-y-0.5">
                                                <div className="text-slate-700 font-mono font-medium">
                                                    {partner.contract_number ? (
                                                        <span>HĐ: {partner.contract_number}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Chưa có số HĐ</span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                    <span>
                                                        {partner.payment_terms_days > 0
                                                            ? `Nợ tối đa ${partner.payment_terms_days} ngày`
                                                            : 'Thanh toán ngay'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cột 5: Đoàn đã đặt */}
                                        <td className="px-4 py-3.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenHistory(partner)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100 hover:border-indigo-300 transition cursor-pointer shadow-2xs group-hover:scale-105"
                                                title="Bấm để xem lịch sử các đơn đặt đoàn của đối tác này"
                                            >
                                                <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>{partner.total_group_bookings || 0} đoàn</span>
                                            </button>
                                        </td>

                                        {/* Cột 6: Trạng thái */}
                                        <td className="px-4 py-3.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenStatusModal(partner)}
                                                disabled={!canUpdate}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                                                    partner.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                                } ${!canUpdate ? 'cursor-default' : 'cursor-pointer'}`}
                                                title={canUpdate ? 'Bấm để đổi trạng thái hợp tác' : ''}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${partner.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                <span>{partner.is_active ? 'Đang hợp tác' : 'Tạm ngưng'}</span>
                                            </button>
                                        </td>

                                        {/* Cột 7: Thao tác */}
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Xem chi tiết hợp đồng */}
                                                <button
                                                    type="button"
                                                    onClick={() => setDetailPartner(partner)}
                                                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-2xs transition cursor-pointer"
                                                    title="Xem chi tiết hợp đồng"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Xem lịch sử đơn đặt đoàn (MICE) */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenHistory(partner)}
                                                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 shadow-2xs transition cursor-pointer"
                                                    title="Xem lịch sử đơn đặt đoàn (MICE)"
                                                >
                                                    <CalendarCheck className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Chỉnh sửa */}
                                                {canUpdate && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPartnerForEdit(partner);
                                                            setIsFormModalOpen(true);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 shadow-2xs transition cursor-pointer"
                                                        title="Chỉnh sửa thông tin"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                {/* Khóa / Mở khóa hợp tác */}
                                                {canUpdate && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenStatusModal(partner)}
                                                        className={`p-1.5 rounded-lg transition shadow-2xs cursor-pointer ${
                                                            partner.is_active
                                                                ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                        }`}
                                                        title={partner.is_active ? 'Khóa đối tác' : 'Kích hoạt hợp tác'}
                                                    >
                                                        {partner.is_active ? (
                                                            <Lock className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <Unlock className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                )}

                                                {/* Xóa */}
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeletePartner(partner)}
                                                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 shadow-2xs transition cursor-pointer"
                                                        title="Xóa đối tác"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Phân trang (Table Footer) */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={partners.length}
                    pageSize={pageSize}
                    pageSizeOptions={[5, 10, 20, 50]}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setCurrentPage(1);
                    }}
                    onPageChange={(page) => setCurrentPage(page)}
                />
            </div>

            {/* MODAL THÊM / CHỈNH SỬA ĐỐI TÁC */}
            <CorporatePartnerModal
                isOpen={isFormModalOpen}
                partner={selectedPartnerForEdit}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setSelectedPartnerForEdit(null);
                }}
                onSuccess={(savedData, actionType) => {
                    showToast(
                        actionType === 'update'
                            ? `Đã cập nhật đối tác ${savedData.company_name}!`
                            : `Đã thêm mới đối tác ${savedData.company_name}!`
                    );
                    fetchPartners();
                }}
            />

            {/* MODAL XEM CHI TIẾT ĐỐI TÁC */}
            {detailPartner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
                        {/* Header: Tone trắng trang nhã */}
                        <div className="p-5 bg-white text-slate-900 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-xs">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900">{detailPartner.company_name}</h3>
                                    <p className="text-xs text-slate-500">Mã: {detailPartner.corporate_code}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailPartner(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                title="Đóng"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-slate-400 font-semibold block">Mã số thuế</span>
                                    <span className="font-mono font-bold text-slate-800 text-sm">{detailPartner.tax_code}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">Mức chiết khấu</span>
                                    <span className="font-bold text-emerald-600 text-sm">Giảm {detailPartner.discount_percent}%</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">Số hợp đồng</span>
                                    <span className="font-mono text-slate-700">{detailPartner.contract_number || 'Chưa cập nhật'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">Hạn mức nợ</span>
                                    <span className="text-slate-700">
                                        {detailPartner.payment_terms_days > 0 ? `${detailPartner.payment_terms_days} ngày` : 'TT ngay khi check-out'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="font-bold text-slate-700">Thông tin liên hệ:</p>
                                <p className="text-slate-600 flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Đại diện: <strong>{detailPartner.contact_person}</strong></span>
                                </p>
                                <p className="text-slate-600 flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                    <span>SĐT: <strong className="font-mono">{detailPartner.contact_phone}</strong></span>
                                </p>
                                <p className="text-slate-600 flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Email: {detailPartner.contact_email}</span>
                                </p>
                                <p className="text-slate-600 flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Địa chỉ: {detailPartner.company_address || 'Chưa cập nhật'}</span>
                                </p>
                            </div>

                            {detailPartner.note && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                                    <p className="font-bold mb-1">Ghi chú điều khoản:</p>
                                    <p className="leading-relaxed">{detailPartner.note}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    const p = detailPartner;
                                    setDetailPartner(null);
                                    handleOpenHistory(p);
                                }}
                                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer transition"
                            >
                                <CalendarCheck className="w-3.5 h-3.5" />
                                <span>Xem lịch sử đơn ({detailPartner.total_group_bookings || 0} đoàn)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDetailPartner(null)}
                                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN XÓA ĐỐI TÁC */}
            {deletePartner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 text-center space-y-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                            deletePartner.total_group_bookings > 0
                                ? 'bg-amber-50 border border-amber-200 text-amber-600'
                                : 'bg-rose-50 border border-rose-200 text-rose-600'
                        }`}>
                            {deletePartner.total_group_bookings > 0 ? (
                                <AlertTriangle className="w-6 h-6" />
                            ) : (
                                <Trash2 className="w-6 h-6" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-900">
                                {deletePartner.total_group_bookings > 0 ? 'Không thể xóa đối tác này' : 'Xác nhận xóa đối tác?'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Đối tác <strong className="text-slate-800">{deletePartner.company_name}</strong> (#{deletePartner.corporate_code})
                            </p>
                            {deletePartner.total_group_bookings > 0 ? (
                                <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl mt-3 border border-amber-200 text-left space-y-1.5">
                                    <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                        Đã phát sinh {deletePartner.total_group_bookings} đơn đặt đoàn / phòng
                                    </p>
                                    <p className="text-[11px] text-amber-700 leading-relaxed">
                                        Hệ thống bảo vệ lịch sử giao dịch và dữ liệu hóa đơn. Vui lòng chuyển trạng thái sang <strong>Tạm ngưng</strong> nếu không còn tiếp tục hợp tác.
                                    </p>
                                </div>
                            ) : (
                                <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg mt-2 border border-amber-200">
                                    Lưu ý: Thao tác này sẽ xóa vĩnh viễn hồ sơ đối tác và không thể hoàn tác.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletePartner(null)}
                                disabled={isDeleting}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                            >
                                {deletePartner.total_group_bookings > 0 ? 'Đóng' : 'Hủy bỏ'}
                            </button>
                            {deletePartner.total_group_bookings > 0 ? (
                                deletePartner.is_active && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const p = deletePartner;
                                            setDeletePartner(null);
                                            handleOpenStatusModal(p);
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md shadow-amber-600/20 transition cursor-pointer"
                                    >
                                        Chuyển sang Tạm ngưng
                                    </button>
                                )
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/30 transition cursor-pointer"
                                >
                                    {isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN KHÓA / KÍCH HOẠT ĐỐI TÁC (TONE TRẮNG HIỆN ĐẠI) */}
            {statusModalPartner && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
                    onClick={() => !isUpdatingStatus && setStatusModalPartner(null)}
                >
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            const willBeActive = !statusModalPartner.is_active;
                            const icon = willBeActive ? <Unlock className="w-8 h-8" /> : <Lock className="w-8 h-8" />;
                            const iconBg = willBeActive
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-rose-50 text-rose-600 border-rose-200';
                            const title = willBeActive ? 'Xác Nhận Kích Hoạt Hợp Tác?' : 'Xác Nhận Tạm Ngưng Hợp Tác?';
                            const desc = willBeActive
                                ? `Bạn có chắc chắn muốn KÍCH HOẠT lại hợp tác với đối tác "${statusModalPartner.company_name}" (#${statusModalPartner.corporate_code})? Đối tác sẽ có thể được áp dụng chiết khấu khi đặt phòng mới.`
                                : `Bạn có chắc chắn muốn TẠM NGƯNG hợp tác với đối tác "${statusModalPartner.company_name}" (#${statusModalPartner.corporate_code})? Đối tác này sẽ tạm thời không thể được chọn khi đặt phòng lẻ hoặc đặt đoàn mới.`;
                            const confirmBtnText = willBeActive ? 'Xác Nhận Kích Hoạt' : 'Xác Nhận Tạm Ngưng';
                            const confirmBtnClass = willBeActive
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30'
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30';

                            return (
                                <div className="p-6 text-center space-y-4">
                                    {/* Icon tròn */}
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xs border ${iconBg}`}>
                                        {icon}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">{title}</h3>
                                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                            {desc}
                                        </p>
                                    </div>

                                    {/* Khung tóm tắt đối tác */}
                                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-left text-xs flex items-center justify-between">
                                        <div className="min-w-0 pr-2">
                                            <div className="font-bold text-slate-900 truncate">
                                                {statusModalPartner.company_name}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                Mã: {statusModalPartner.corporate_code} • MST: {statusModalPartner.tax_code}
                                            </div>
                                        </div>
                                        <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            Giảm {statusModalPartner.discount_percent}%
                                        </span>
                                    </div>

                                    {/* Nút hành động */}
                                    <div className="flex items-center justify-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setStatusModalPartner(null)}
                                            disabled={isUpdatingStatus}
                                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            Hủy Bỏ
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmToggleStatus}
                                            disabled={isUpdatingStatus}
                                            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${confirmBtnClass}`}
                                        >
                                            {isUpdatingStatus && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                                            <span>{confirmBtnText}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* MODAL LỊCH SỬ ĐƠN ĐẶT DOANH NGHIỆP (TÁCH RIÊNG COMPONENT & PHÂN TRANG) */}
            <CorporatePartnerHistoryModal
                isOpen={Boolean(historyPartner)}
                partner={historyPartner}
                onClose={() => setHistoryPartner(null)}
            />
        </div>
    );
}
