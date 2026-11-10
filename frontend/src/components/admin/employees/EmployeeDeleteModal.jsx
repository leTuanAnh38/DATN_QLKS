import React from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';

export default function EmployeeDeleteModal({
    isOpen,
    onClose,
    employee,
    onConfirm,
    isSubmitting = false,
    getRoleBadge
}) {
    if (!isOpen || !employee) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner border border-rose-200">
                        <Trash2 className="w-8 h-8 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Xác Nhận Xóa Nhân Viên?
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Hành động này sẽ xóa vĩnh viễn tài khoản nhân sự và hủy toàn bộ quyền đăng nhập hệ thống.
                        </p>
                    </div>

                    {/* Card tóm tắt nhân viên sắp bị xóa */}
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

                    <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] text-left flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                            Lưu ý: Không thể phục hồi tài khoản sau khi xóa. Nếu chỉ muốn ngưng làm việc tạm thời, bạn nên chọn chức năng <strong>"Khóa tài khoản"</strong>.
                        </div>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isSubmitting}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                    <span>Đang xóa...</span>
                                </>
                            ) : (
                                'Xóa Vĩnh Viễn'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

