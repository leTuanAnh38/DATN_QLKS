import React, { useState, useEffect } from 'react';
import { X, User, ShieldCheck } from 'lucide-react';
import {
    HOTEL_DEPARTMENTS,
    HOTEL_SHIFTS,
    getPositionsByDepartment,
    generateEmployeeCode
} from './employeeConstants';
import { formatCurrency } from '../../../utils/formatters';

export default function EmployeeCreateModal({
    isOpen,
    onClose,
    availableRoles = [],
    onSubmit,
    isSubmitting = false
}) {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: 'Password123',
        role: 'receptionist',
        employee_code: '',
        department: 'Lễ Tân & Tiền Sảnh',
        position: 'Nhân Viên Lễ Tân (Receptionist)',
        shift: 'Ca Sáng (06:00 - 14:00)',
        salary_base: '11000000',
        hire_date: new Date().toISOString().split('T')[0],
        customPosition: false,
    });

    useEffect(() => {
        if (isOpen) {
            const initialDept = 'Lễ Tân & Tiền Sảnh';
            const initialCode = generateEmployeeCode(initialDept);
            const defaultPos = getPositionsByDepartment(initialDept)[2] || 'Nhân Viên Lễ Tân (Receptionist)';
            setFormData({
                fullName: '',
                email: '',
                phone: '',
                password: `Pass${Math.floor(100000 + Math.random() * 900000)}`,
                role: 'receptionist',
                employee_code: initialCode,
                department: initialDept,
                position: defaultPos,
                shift: 'Ca Sáng (06:00 - 14:00)',
                salary_base: '11000000',
                hire_date: new Date().toISOString().split('T')[0],
                customPosition: false,
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleRoleChange = (newRole) => {
        const foundDept = HOTEL_DEPARTMENTS.find((d) => d.defaultRole === newRole);
        if (foundDept) {
            const positions = foundDept.positions;
            setFormData((prev) => ({
                ...prev,
                role: newRole,
                department: foundDept.name,
                position: positions[0] || 'Nhân viên',
                employee_code: generateEmployeeCode(foundDept.name),
                customPosition: false,
            }));
        } else {
            setFormData((prev) => ({ ...prev, role: newRole }));
        }
    };

    const handleDepartmentChange = (newDept) => {
        const found = HOTEL_DEPARTMENTS.find((d) => d.name === newDept);
        const positions = getPositionsByDepartment(newDept);
        setFormData((prev) => ({
            ...prev,
            department: newDept,
            position: positions[0] || 'Nhân viên',
            role: found?.defaultRole || prev.role,
            employee_code: generateEmployeeCode(newDept),
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
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl font-bold shadow-xs">
                            ＋
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                Thêm Mới Nhân Viên & Tài Khoản Nội Bộ
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Khởi tạo tài khoản, phân quyền vai trò, chọn phòng ban, chức danh và ca làm việc
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-800 overflow-y-auto flex-1">
                    {/* Khối 1: Thông tin tài khoản đăng nhập */}
                    <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-blue-700 mb-3 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-blue-700" />
                            <span>1. Thông tin cá nhân & Tài khoản</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Họ và tên nhân viên *</label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: Lê Hoàng Minh"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
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
                                <label className="block font-bold text-slate-700 mb-1">Email đăng nhập *</label>
                                <input
                                    type="email"
                                    placeholder="minh.le@tadanang.vn"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Số điện thoại liên hệ *</label>
                                <input
                                    type="tel"
                                    placeholder="0905123456"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    required
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block font-bold text-slate-700 mb-1">Mật khẩu khởi tạo *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, password: `Pass${Math.floor(100000 + Math.random() * 900000)}` })}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs shrink-0 cursor-pointer"
                                    >
                                        Tạo ngẫu nhiên
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Khối 2: Phân quyền vai trò, Phòng ban, Chức danh & Ca làm việc */}
                    <div className="pt-2 border-t border-slate-100">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                            <span>2. Phân quyền & Vị trí công tác</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* 1. Vai trò (Role) */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Vai trò phân quyền (RBAC) *
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => handleRoleChange(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-bold text-blue-700"
                                >
                                    {availableRoles.map((r) => (
                                        <option key={r.code || r.role} value={r.code || r.role}>
                                            {r.name || r.title || r.code}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Phòng ban (Department) */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Phòng ban trực thuộc *
                                </label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => handleDepartmentChange(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                >
                                    {HOTEL_DEPARTMENTS.map((dept) => (
                                        <option key={dept.name} value={dept.name}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Chức danh (Position) */}
                            <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-slate-700">
                                        Chức danh / Vị trí *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, customPosition: !formData.customPosition })}
                                        className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                                    >
                                        {formData.customPosition ? '← Chọn từ danh sách gợi ý' : '＋ Nhập chức danh khác'}
                                    </button>
                                </div>
                                {formData.customPosition ? (
                                    <input
                                        type="text"
                                        placeholder="Nhập tên chức danh tùy chỉnh..."
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        required
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

                            {/* 4. Ca làm việc (Shift) */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ca làm việc trực thuộc *
                                </label>
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

                            {/* 5. Lương cơ bản */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Mức lương cơ bản (VND) *
                                </label>
                                <input
                                    type="number"
                                    step="500000"
                                    value={formData.salary_base}
                                    onChange={(e) => setFormData({ ...formData, salary_base: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    required
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Tương đương: {formatCurrency(formData.salary_base)}
                                </span>
                            </div>

                            {/* 6. Ngày vào làm */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ngày bắt đầu vào làm *
                                </label>
                                <input
                                    type="date"
                                    value={formData.hire_date}
                                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Nút hành động */}
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
                            {isSubmitting ? 'Đang khởi tạo...' : 'Tạo Tài Khoản Nhân Viên'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

