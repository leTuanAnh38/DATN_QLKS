import React, { useState, useEffect } from 'react';
import {
    Building2,
    Hash,
    MapPin,
    User,
    Phone,
    Mail,
    FileText,
    Percent,
    X,
    Check,
    AlertCircle,
    Loader2,
    Tag
} from 'lucide-react';
import { bookingService } from '../../../../services/bookingService';

export default function CorporatePartnerModal({
    isOpen,
    onClose,
    onSuccess,
    partner = null // null: Thêm mới, object: Chỉnh sửa
}) {
    const isEdit = Boolean(partner && partner.id);

    const [formData, setFormData] = useState({
        company_name: '',
        tax_code: '',
        company_address: '',
        corporate_code: '',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
        contract_number: '',
        discount_percent: 10,
        payment_terms_days: 0,
        is_active: true,
        note: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (partner) {
            setFormData({
                company_name: partner.company_name || '',
                tax_code: partner.tax_code || '',
                company_address: partner.company_address || '',
                corporate_code: partner.corporate_code || '',
                contact_person: partner.contact_person || '',
                contact_phone: partner.contact_phone || '',
                contact_email: partner.contact_email || '',
                contract_number: partner.contract_number || '',
                discount_percent: partner.discount_percent !== undefined ? partner.discount_percent : 10,
                payment_terms_days: partner.payment_terms_days !== undefined ? partner.payment_terms_days : 0,
                is_active: partner.is_active !== undefined ? partner.is_active : true,
                note: partner.note || ''
            });
        } else {
            setFormData({
                company_name: '',
                tax_code: '',
                company_address: '',
                corporate_code: '',
                contact_person: '',
                contact_phone: '',
                contact_email: '',
                contract_number: '',
                discount_percent: 10,
                payment_terms_days: 0,
                is_active: true,
                note: ''
            });
        }
        setErrorMessage('');
    }, [partner, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Tự động tạo mã Corporate Code gợi ý từ tên công ty nếu đang tạo mới và chưa có mã
    const handleGenerateCode = () => {
        if (!formData.company_name) return;
        const initials = formData.company_name
            .trim()
            .split(/\s+/)
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
        const year = new Date().getFullYear();
        const code = `${initials.slice(0, 5)}${year}`;
        setFormData(prev => ({ ...prev, corporate_code: code }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        // Client-side validation cơ bản
        if (!formData.company_name.trim()) {
            setErrorMessage('Vui lòng nhập tên công ty / doanh nghiệp.');
            return;
        }
        if (!formData.tax_code.trim()) {
            setErrorMessage('Vui lòng nhập mã số thuế (MST).');
            return;
        }
        if (!formData.corporate_code.trim()) {
            setErrorMessage('Vui lòng nhập mã định danh doanh nghiệp / mã ưu đãi.');
            return;
        }
        if (!formData.contact_person.trim()) {
            setErrorMessage('Vui lòng nhập người đại diện liên hệ.');
            return;
        }
        if (!formData.contact_phone.trim()) {
            setErrorMessage('Vui lòng nhập số điện thoại liên hệ.');
            return;
        }

        setIsSubmitting(true);

        const payload = {
            ...formData,
            corporate_code: formData.corporate_code.trim().toUpperCase(),
            discount_percent: parseFloat(formData.discount_percent) || 0,
            payment_terms_days: parseInt(formData.payment_terms_days, 10) || 0
        };

        let res;
        if (isEdit) {
            res = await bookingService.updateCorporatePartner(partner.id, payload);
        } else {
            res = await bookingService.createCorporatePartner(payload);
        }

        setIsSubmitting(false);

        if (res.success) {
            onSuccess && onSuccess(res.data, isEdit ? 'update' : 'create');
            onClose();
        } else {
            setErrorMessage(res.message || 'Có lỗi xảy ra khi lưu thông tin đối tác.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-5 bg-white text-slate-900 flex items-center justify-between border-b border-slate-200">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-xs">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                {isEdit ? 'Chỉnh sửa Đối tác Doanh nghiệp' : 'Thêm mới Đối tác Doanh nghiệp (B2B)'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {isEdit ? `Mã: ${partner.corporate_code} • ${partner.company_name}` : 'Thiết lập thông tin pháp lý, mã chiết khấu & hạn mức công nợ'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        title="Đóng"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body / Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
                    {errorMessage && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* KHỐI 1: THÔNG TIN DOANH NGHIỆP & PHÁP LÝ */}
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>1. Thông tin Doanh nghiệp & Pháp lý</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Tên công ty */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Tên Công ty / Doanh nghiệp <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="company_name"
                                    required
                                    value={formData.company_name}
                                    onChange={handleChange}
                                    placeholder="VD: Công ty Cổ phần Viễn thông FPT"
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                />
                            </div>

                            {/* Mã số thuế */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Mã số thuế (MST) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        name="tax_code"
                                        required
                                        value={formData.tax_code}
                                        onChange={handleChange}
                                        placeholder="VD: 0101778163"
                                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono transition"
                                    />
                                </div>
                            </div>

                            {/* Mã Doanh nghiệp / Mã ưu đãi B2B */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-slate-700">
                                        Mã B2B / Mã Ưu đãi <span className="text-rose-500">*</span>
                                    </label>
                                    {!isEdit && (
                                        <button
                                            type="button"
                                            onClick={handleGenerateCode}
                                            className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                                        >
                                            Gợi ý mã
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        name="corporate_code"
                                        required
                                        value={formData.corporate_code}
                                        onChange={(e) => setFormData(prev => ({ ...prev, corporate_code: e.target.value.toUpperCase() }))}
                                        placeholder="VD: FPT2026"
                                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono font-bold tracking-wider uppercase transition"
                                    />
                                </div>
                            </div>

                            {/* Địa chỉ trụ sở */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Địa chỉ đăng ký kinh doanh
                                </label>
                                <div className="relative">
                                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        name="company_address"
                                        value={formData.company_address}
                                        onChange={handleChange}
                                        placeholder="VD: Tòa nhà FPT Cầu Giấy, 17 Duy Tân, Cầu Giấy, Hà Nội"
                                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI 2: ĐẠI DIỆN LIÊN HỆ */}
                    <div className="pt-2 border-t border-slate-200">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            <span>2. Người đại diện / Liên hệ phụ trách</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Họ tên người liên hệ */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Người đại diện <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        name="contact_person"
                                        required
                                        value={formData.contact_person}
                                        onChange={handleChange}
                                        placeholder="Nguyễn Văn A"
                                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                    />
                                </div>
                            </div>

                            {/* Số điện thoại */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Số điện thoại <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="tel"
                                        name="contact_phone"
                                        required
                                        value={formData.contact_phone}
                                        onChange={handleChange}
                                        placeholder="0987 654 321"
                                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                    />
                                </div>
                            </div>

                            {/* Email nhận hóa đơn/báo giá */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Email nhận hóa đơn <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="email"
                                        name="contact_email"
                                        required
                                        value={formData.contact_email}
                                        onChange={handleChange}
                                        placeholder="billing@fpt.com"
                                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI 3: HỢP ĐỒNG & CHÍNH SÁCH TÀI CHÍNH */}
                    <div className="pt-2 border-t border-slate-200">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>3. Hợp đồng, Chiết khấu & Hạn mức thanh toán</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Số hợp đồng */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Số Hợp đồng
                                </label>
                                <input
                                    type="text"
                                    name="contract_number"
                                    value={formData.contract_number}
                                    onChange={handleChange}
                                    placeholder="HĐ-2026/FPT-HTL"
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono transition"
                                />
                            </div>

                            {/* Tỷ lệ chiết khấu (%) */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Chiết khấu phòng B2B (%) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Percent className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="number"
                                        name="discount_percent"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        required
                                        value={formData.discount_percent}
                                        onChange={handleChange}
                                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-bold text-indigo-700 transition"
                                    />
                                </div>
                            </div>

                            {/* Hạn mức công nợ (ngày) */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Hạn mức nợ (Số ngày)
                                </label>
                                <select
                                    name="payment_terms_days"
                                    value={formData.payment_terms_days}
                                    onChange={handleChange}
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white transition cursor-pointer"
                                >
                                    <option value="0">Thanh toán ngay khi Check-out</option>
                                    <option value="15">Công nợ 15 ngày</option>
                                    <option value="30">Công nợ 30 ngày (Chuẩn B2B)</option>
                                    <option value="45">Công nợ 45 ngày</option>
                                    <option value="60">Công nợ 60 ngày</option>
                                </select>
                            </div>

                            {/* Ghi chú điều khoản */}
                            <div className="md:col-span-3">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Ghi chú điều khoản đặc biệt / Cam kết phòng
                                </label>
                                <textarea
                                    name="note"
                                    rows="2"
                                    value={formData.note}
                                    onChange={handleChange}
                                    placeholder="VD: Áp dụng miễn phí ăn sáng buffet cho 2 người lớn mỗi phòng, cam kết giữ tối thiểu 10 phòng cho các sự kiện quý..."
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition resize-none"
                                />
                            </div>

                            {/* Trạng thái hợp tác */}
                            <div className="md:col-span-3 flex items-center gap-3 pt-1">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="is_active"
                                        checked={formData.is_active}
                                        onChange={handleChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">
                                        {formData.is_active ? 'Đang kích hoạt hợp tác (Active)' : 'Tạm ngưng hợp tác (Inactive)'}
                                    </span>
                                    <p className="text-xs text-slate-500">
                                        {formData.is_active
                                            ? 'Đối tác có thể được chọn khi đặt phòng lẻ tại quầy hoặc đặt đoàn.'
                                            : 'Tạm ẩn khỏi danh sách lựa chọn đặt phòng mới, bảo lưu lịch sử cũ.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>{isEdit ? 'Cập nhật đối tác' : 'Tạo mới đối tác'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
