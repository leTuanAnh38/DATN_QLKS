import React from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';

export default function EmployeeToggleStatusModal({
    isOpen,
    onClose,
    employee,
    onConfirm,
    isSubmitting = false,
    getRoleBadge
}) {
    if (!isOpen || !employee) return null;

    const isLocking = Boolean(employee.is_active);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 text-center space-y-4">
                    <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner border ${
                            isLocking
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}
                    >
                        {isLocking ? (
                            <Lock className="w-8 h-8 text-amber-600" />
                        ) : (
                            <Unlock className="w-8 h-8 text-emerald-600" />
                        )}
                    </div>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            {isLocking ? 'Xác Nhận Khóa Tài Khoản?' : 'Xác Nhận Mở Khóa Tài Khoản?'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            {isLocking
                                ? 'Tài khoản này sẽ bị tạm ngưng quyền đăng nhập vào hệ thống cho đến khi được mở khóa lại.'
                                : 'Khôi phục quyền đăng nhập và cho phép nhân viên tiếp tục truy cập hệ thống.'}
                        </p>
                    </div>

                    {/* Card tóm tắt nhân viên */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left flex items-center gap-3">
                        <UserAvatar
                            avatar={employee.avatar}
                            name={employee.full_name || employee.username}
                            role={employee.role}
                            size="md"
                            border={false}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-xs truncate">
                                {employee.full_name || employee.username}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                                Mã: {employee.employee_profile?.employee_code || employee.id} • {employee.employee_profile?.department}
                            </div>
                            <div className="mt-1">
                                {getRoleBadge ? getRoleBadge(employee.role) : null}
                            </div>
                        </div>
                    </div>

                    {isLocking ? (
                        <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] text-left flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                Lưu ý: Hồ sơ nhân sự, lịch sử ca trực và nhật ký hoạt động vẫn được giữ nguyên. Bạn có thể mở khóa lại bất cứ lúc nào.
                            </div>
                        </div>
                    ) : (
                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] text-left flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                Nhân viên sẽ sử dụng lại tên đăng nhập, mật khẩu và vai trò phân quyền trước đó.
                            </div>
                        </div>
                    )}

                    <div className="pt-2 flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isSubmitting}
                            className={`w-full py-2.5 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 ${
                                isLocking
                                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                    <span>Đang xử lý...</span>
                                </>
                            ) : isLocking ? (
                                'Khóa Tài Khoản'
                            ) : (
                                'Mở Khóa Tài Khoản'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

