import React, { useState, useEffect } from 'react';
import { Pencil, X, KeyRound, Sparkles } from 'lucide-react';
import {
    HOTEL_DEPARTMENTS,
    HOTEL_SHIFTS,
    getPositionsByDepartment
} from './employeeConstants';
import { formatCurrency } from '../../../utils/formatters';

export default function EmployeeEditModal({
    isOpen,
    onClose,
    employee,
    onSubmit,
    isSubmitting = false
}) {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone_number: '',
        address: '',
        password: '',
        showPassword: false,
        employee_code: '',
        department: '',
        position: '',
        shift: '',
        salary_base: '',
        hire_date: '',
        is_active: true,
        customPosition: false,
    });

    useEffect(() => {
        if (isOpen && employee) {
            const profile = employee.employee_profile || {};
            const standardPositions = getPositionsByDepartment(profile.department || '');
            const isCustom = Boolean(profile.position && !standardPositions.includes(profile.position));
            setFormData({
                full_name: employee.full_name || employee.username || '',
                email: employee.email || '',
                phone_number: employee.phone_number || '',
                address: employee.address || '',
                password: '',
                showPassword: false,
                employee_code: profile.employee_code || String(employee.id || ''),
                department: profile.department || HOTEL_DEPARTMENTS[1].name,
                position: profile.position || HOTEL_DEPARTMENTS[1].positions[0],
                shift: profile.shift || HOTEL_SHIFTS[0],
                salary_base: String(profile.salary_base || '11000000'),
                hire_date: profile.hire_date || '',
                is_active: Boolean(employee.is_active),
                customPosition: isCustom,
            });
        }
    }, [isOpen, employee]);

    if (!isOpen || !employee) return null;

    const handleDepartmentChange = (newDept) => {
        const positions = getPositionsByDepartment(newDept);
        setFormData((prev) => ({
            ...prev,
            department: newDept,
            position: positions[0] || 'Nhân viên',
            customPosition: false,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSubmit) {
            onSubmit(formData);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                            <Pencil className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                Chỉnh Sửa Hồ Sơ Nhân Viên
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {employee.full_name || employee.username} (Mã: {employee.employee_profile?.employee_code || employee.id})
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

                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Họ và tên *</label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                required
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Mã Nhân Viên *</label>
                            <input
                                type="text"
                                value={formData.employee_code}
                                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono font-bold text-blue-600"
                                required
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Email liên hệ *</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                required
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Số điện thoại *</label>
                            <input
                                type="tel"
                                value={formData.phone_number}
                                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                            />
                        </div>

                        {/* Phòng ban */}
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Phòng ban trực thuộc</label>
                            <select
                                value={formData.department}
                                onChange={(e) => handleDepartmentChange(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-semibold"
                            >
                                {HOTEL_DEPARTMENTS.map((dept) => (
                                    <option key={dept.name} value={dept.name}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Chức danh */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="font-bold text-slate-700">Chức danh / Vị trí</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, customPosition: !formData.customPosition })}
                                    className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                                >
                                    {formData.customPosition ? '← Chọn gợi ý' : '＋ Nhập khác'}
                                </button>
                            </div>
                            {formData.customPosition ? (
                                <input
                                    type="text"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                />
                            ) : (
                                <select
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                >
                                    {getPositionsByDepartment(formData.department).map((pos) => (
                                        <option key={pos} value={pos}>
                                            {pos}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Ca làm việc */}
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Ca làm việc</label>
                            <select
                                value={formData.shift}
                                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                            >
                                {HOTEL_SHIFTS.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lương cơ bản */}
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Lương cơ bản (VND)</label>
                            <input
                                type="number"
                                step="500000"
                                value={formData.salary_base}
                                onChange={(e) => setFormData({ ...formData, salary_base: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                            />
                            <span className="text-[11px] text-slate-400 mt-1 block">
                                Định dạng: {formatCurrency(formData.salary_base)}
                            </span>
                        </div>

                        {/* Ngày vào làm */}
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Ngày vào làm</label>
                            <input
                                type="date"
                                value={formData.hire_date || ''}
                                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                            />
                        </div>

                        {/* Trạng thái */}
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Trạng thái tài khoản</label>
                            <select
                                value={formData.is_active ? 'active' : 'inactive'}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-semibold"
                            >
                                <option value="active">Đang hoạt động bình thường</option>
                                <option value="inactive">Đang tạm khóa / Nghỉ việc</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block font-bold text-slate-700 mb-1">Địa chỉ thường trú</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                placeholder="Ví dụ: 128 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng"
                            />
                        </div>

                        {/* Đặt lại mật khẩu mới cho nhân viên */}
                        <div className="sm:col-span-2 p-4 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                                    <label className="font-bold text-slate-800 text-xs">
                                        Cấp lại Mật khẩu mới cho nhân viên
                                    </label>
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                        Admin Reset
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const randomPass = 'Pass@' + Math.floor(100000 + Math.random() * 900000);
                                        setFormData({ ...formData, password: randomPass, showPassword: true });
                                    }}
                                    className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-blue-600 inline mr-1" />
                                    <span>Tạo ngẫu nhiên</span>
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={formData.showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự) hoặc để trống nếu giữ nguyên..."
                                    className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-mono text-xs"
                                    minLength={6}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {formData.password && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, password: '' })}
                                            className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                            title="Xóa mật khẩu đã nhập"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                                    >
                                        {formData.showPassword ? 'Ẩn' : 'Hiện'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 italic">
                                * Lưu ý: Nếu không cần đổi mật khẩu của nhân viên, vui lòng <strong>để trống ô này</strong>. Mật khẩu mới sau khi lưu sẽ có hiệu lực ngay lập tức.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

