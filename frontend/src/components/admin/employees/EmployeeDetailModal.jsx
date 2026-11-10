import React from 'react';
import { User, X, ShieldCheck, Pencil } from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';
import { formatCurrency } from '../../../utils/formatters';

export default function EmployeeDetailModal({
    isOpen,
    onClose,
    employee,
    isManager = false,
    onOpenAssignRole,
    onOpenEdit,
    getRoleBadge
}) {
    if (!isOpen || !employee) return null;

    const profile = employee.employee_profile || {};
    const isRestrictedRole = isManager && ['admin', 'owner', 'manager'].includes(employee.role);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                            <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                Hồ Sơ Chi Tiết Cán Bộ Nhân Viên
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Khách Sạn TA Đà Nẵng • Mã: {profile.employee_code || employee.id}
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

                <div className="p-6 space-y-5 text-xs text-slate-800 overflow-y-auto flex-1">
                    {/* Profile Card Header */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <UserAvatar
                            avatar={employee.avatar}
                            name={employee.full_name || employee.username}
                            role={employee.role}
                            size="xl"
                            border={true}
                        />
                        <div className="text-center sm:text-left flex-1 min-w-0">
                            <div className="flex items-center justify-center sm:justify-start gap-2">
                                <h3 className="text-lg font-bold text-slate-900 truncate">
                                    {employee.full_name || employee.username}
                                </h3>
                                {employee.is_active ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                        Hoạt động
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                        Đã khóa
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                Mã nhân viên: <strong>{profile.employee_code || employee.id}</strong> • Username: @{employee.username}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                {getRoleBadge ? getRoleBadge(employee.role) : null}
                                <span className="bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                                    {profile.department || 'Chung'}
                                </span>
                                <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                                    {profile.position || 'Nhân viên'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Thông tin công tác */}
                    <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
                            THÔNG TIN CÔNG TÁC & VỊ TRÍ
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Phòng ban</span>
                                <strong className="text-slate-900 text-xs block mt-0.5">
                                    {profile.department || 'Chưa cập nhật'}
                                </strong>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Chức danh</span>
                                <strong className="text-slate-900 text-xs block mt-0.5">
                                    {profile.position || 'Nhân viên'}
                                </strong>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Ca làm việc</span>
                                <strong className="text-slate-900 text-xs block mt-0.5">
                                    {profile.shift || 'Chưa xếp ca'}
                                </strong>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Lương cơ bản</span>
                                <strong className="text-emerald-600 text-xs block mt-0.5">
                                    {formatCurrency(profile.base_salary || profile.salary_base)}
                                </strong>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Ngày vào làm</span>
                                <strong className="text-slate-900 text-xs block mt-0.5 font-mono">
                                    {profile.hire_date || 'Chưa cập nhật'}
                                </strong>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Quyền hạn Staff</span>
                                <strong className="text-slate-900 text-xs block mt-0.5">
                                    {employee.is_staff ? 'Có quyền Staff' : 'Nhân sự vận hành'}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Thông tin liên hệ */}
                    <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
                            THÔNG TIN LIÊN HỆ & TÀI KHOẢN
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Email công việc</span>
                                <strong className="text-slate-900 text-xs block mt-0.5">
                                    {employee.email || 'Chưa có email'}
                                </strong>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Số điện thoại</span>
                                <strong className="text-slate-900 text-xs block mt-0.5">
                                    {employee.phone_number || 'Chưa cập nhật'}
                                </strong>
                            </div>
                            <div className="sm:col-span-2 p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Địa chỉ thường trú</span>
                                <p className="text-slate-700 text-xs mt-0.5">
                                    {employee.address || 'Chưa cập nhật địa chỉ'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {!isRestrictedRole && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            if (onOpenAssignRole) onOpenAssignRole(employee);
                                        }}
                                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Phân quyền vai trò</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            if (onOpenEdit) onOpenEdit(employee);
                                        }}
                                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        <span>Sửa hồ sơ</span>
                                    </button>
                                </>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

