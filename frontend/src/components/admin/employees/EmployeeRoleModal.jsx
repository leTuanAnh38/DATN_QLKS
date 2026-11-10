import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, AlertTriangle } from 'lucide-react';
import { HOTEL_DEPARTMENTS } from './employeeConstants';

export default function EmployeeRoleModal({
    isOpen,
    onClose,
    employee,
    availableRoles = [],
    onSubmit,
    isSubmitting = false,
    onOpenRoleMatrix
}) {
    const [assignRoleData, setAssignRoleData] = useState({
        role: '',
        department: '',
        position: '',
        shift: '',
        autoSync: true,
    });

    useEffect(() => {
        if (isOpen && employee) {
            const profile = employee.employee_profile || {};
            setAssignRoleData({
                role: employee.role || 'receptionist',
                department: profile.department || HOTEL_DEPARTMENTS[1].name,
                position: profile.position || HOTEL_DEPARTMENTS[1].positions[0],
                shift: profile.shift || 'Ca Sáng (06:00 - 14:00)',
                autoSync: true,
            });
        }
    }, [isOpen, employee]);

    if (!isOpen || !employee) return null;

    const handleAssignRoleChange = (roleCode) => {
        if (assignRoleData.autoSync) {
            const foundDept = HOTEL_DEPARTMENTS.find((d) => d.defaultRole === roleCode);
            if (foundDept) {
                setAssignRoleData((prev) => ({
                    ...prev,
                    role: roleCode,
                    department: foundDept.name,
                    position: foundDept.positions[0] || prev.position,
                }));
                return;
            }
        }
        setAssignRoleData((prev) => ({ ...prev, role: roleCode }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSubmit) {
            onSubmit(assignRoleData);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-xs">
                            <ShieldCheck className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                Phân Quyền Vai Trò & Vị Trí Cho Nhân Viên
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

                <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-800 overflow-y-auto flex-1">
                    {/* Danh sách các vai trò RBAC */}
                    <div>
                        <label className="block font-bold text-slate-700 mb-2">
                            Lựa chọn vai trò nội bộ (RBAC):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                            {availableRoles.map((r) => {
                                const roleCode = r.code || r.role;
                                const roleTitle = r.name || r.title || roleCode;
                                const isSelected = assignRoleData.role === roleCode;
                                return (
                                    <div
                                        key={roleCode}
                                        onClick={() => handleAssignRoleChange(roleCode)}
                                        className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                                            isSelected
                                                ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-1">
                                            <span className="font-bold text-xs text-slate-900">
                                                {roleTitle}
                                            </span>
                                            <input
                                                type="radio"
                                                name="roleOption"
                                                checked={isSelected}
                                                onChange={() => handleAssignRoleChange(roleCode)}
                                                className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 line-clamp-2 mb-1.5">
                                            {r.description}
                                        </p>
                                        <div className="flex flex-wrap gap-1 text-[8px] font-bold">
                                            {r.permissions?.rooms && (
                                                <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded">
                                                    Phòng: {r.permissions.rooms}
                                                </span>
                                            )}
                                            {r.permissions?.finance && (
                                                <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded">
                                                    Thu chi: {r.permissions.finance}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tùy chọn đồng bộ phòng ban & chức danh */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800">
                                Đồng bộ Phòng ban, Chức danh & Ca trực:
                            </span>
                            <label className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={assignRoleData.autoSync}
                                    onChange={(e) => setAssignRoleData({ ...assignRoleData, autoSync: e.target.checked })}
                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Tự động gợi ý chuẩn theo vai trò</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phòng ban</label>
                                <select
                                    value={assignRoleData.department}
                                    onChange={(e) => setAssignRoleData({ ...assignRoleData, department: e.target.value })}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                                >
                                    {HOTEL_DEPARTMENTS.map((dept) => (
                                        <option key={dept.name} value={dept.name}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh</label>
                                <input
                                    type="text"
                                    value={assignRoleData.position}
                                    onChange={(e) => setAssignRoleData({ ...assignRoleData, position: e.target.value })}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cảnh báo cấp quyền quản trị */}
                    {['admin', 'owner', 'manager'].includes(assignRoleData.role) && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <strong>Cấp bậc Quản lý cao cấp:</strong> Vai trò này sẽ cấp quyền truy cập vào cổng quản trị <strong>AdminDashboard</strong> và toàn quyền xem số liệu doanh thu, phân bổ phòng và nhân sự của khách sạn.
                            </div>
                        </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        {onOpenRoleMatrix ? (
                            <button
                                type="button"
                                onClick={onOpenRoleMatrix}
                                className="text-blue-600 font-bold hover:underline flex items-center gap-1.5 cursor-pointer text-xs"
                            >
                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                                <span>Xem chi tiết ma trận toàn quyền</span>
                            </button>
                        ) : <div />}
                        <div className="flex items-center gap-2">
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
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? 'Đang lưu...' : 'Xác Nhận Phân Quyền'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

