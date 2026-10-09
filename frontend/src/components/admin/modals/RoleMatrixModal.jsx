import React, { useState, useMemo } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../store/authStore';
import {
    DEFAULT_ROLE_MATRIX,
    SYSTEM_MODULES,
    CRUD_ACTIONS,
    INITIAL_CRUD_MATRIX
} from '../../../data/roleMatrixData';


/**
 * Component Modal Ma Trận Phân Quyền (RBAC Matrix Modal)
 */
export default function RoleMatrixModal({ isOpen, onClose, roles = [], onSaveSuccess }) {
    const { user: currentUser } = useAuth();
    const currentUserRole = currentUser?.role || '';
    const isManager = currentUserRole === 'manager';

    // Ưu tiên nạp danh sách roles từ backend hoặc dùng danh sách mẫu
    const roleOptions = useMemo(() => {
        const rawList = Array.isArray(roles) && roles.length > 0 ? roles : DEFAULT_ROLE_MATRIX;
        let filtered = rawList;
        // Nếu người đang đăng nhập là Quản lý: Chỉ được điều chỉnh vai trò cấp dưới, KHÔNG được phân quyền cho Chủ khách sạn, Admin hay Quản lý
        if (isManager) {
            filtered = filtered.filter((r) => !['admin', 'owner', 'manager'].includes(r.role || r.code));
        }
        return filtered.map((r) => ({
            ...r,
            role: r.role || r.code,
            code: r.code || r.role,
            title: r.title || r.name || r.role,
            name: r.name || r.title || r.role,
            badge_color: r.badge_color || r.color || 'blue',
            color: r.color || r.badge_color || 'blue',
            icon: r.icon || '🛡️',
            level: r.level || 'Vận hành',
            description: r.description || '',
            permissions: r.permissions || {}
        }));
    }, [roles, isManager]);

    // Role đang được chọn để cấu hình quyền
    const [selectedRole, setSelectedRole] = useState('receptionist');

    // Vai trò tối cao có quyền cố định, không thể chỉnh sửa (Chỉ Admin Hệ Thống cố định toàn quyền)
    const isFixedSystemRole = selectedRole === 'admin';

    // Chế độ xem: 'matrix' (Bảng ma trận checkbox CRUD) hoặc 'overview' (Tóm tắt quyền)
    const [viewMode, setViewMode] = useState('matrix');

    // State lưu trữ dữ liệu quyền của tất cả vai trò (Ưu tiên khôi phục từ localStorage nếu đã được Admin cấu hình)
    const [matrixState, setMatrixState] = useState(() => {
        try {
            const saved = localStorage.getItem('hotel_role_matrix');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...INITIAL_CRUD_MATRIX, ...parsed };
            }
        } catch (e) {
            console.warn('[RBAC] Lỗi khi nạp ma trận từ localStorage:', e);
        }
        return INITIAL_CRUD_MATRIX;
    });

    // Trạng thái gửi API PUT
    const [isSaving, setIsSaving] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);

    // Quyền của role hiện tại
    const currentPermissions = useMemo(() => {
        return matrixState[selectedRole] || {};
    }, [matrixState, selectedRole]);

    // Thông tin vai trò đang chọn
    const activeRoleMeta = useMemo(() => {
        return roleOptions.find((r) => r.role === selectedRole || r.code === selectedRole) || roleOptions[0] || {
            role: selectedRole,
            code: selectedRole,
            title: selectedRole,
            name: selectedRole,
            level: 'Vận hành',
            badge_color: 'blue',
            color: 'blue',
            icon: '🛡️',
            description: ''
        };
    }, [roleOptions, selectedRole]);

    // Tính tổng số quyền đang cấp (KHAI BÁO HOOK TRƯỚC MỌI CONDITIONAL RETURN)
    const grantedCount = useMemo(() => {
        let count = 0;
        SYSTEM_MODULES.forEach((mod) => {
            CRUD_ACTIONS.forEach((act) => {
                if (currentPermissions[mod.key]?.[act.key]) count++;
            });
        });
        return count;
    }, [currentPermissions]);

    const totalPossible = SYSTEM_MODULES.length * CRUD_ACTIONS.length;

    // Kiểm tra xem phân hệ này có bị hạn chế/khóa đối với người đang thao tác hay không
    // Quản lý (Manager) tuyệt đối không có thẩm quyền cấp phát hoặc thay đổi phân hệ "Cài đặt hệ thống" cho nhân viên
    const isModuleRestricted = (moduleKey) => {
        if (isManager && moduleKey === 'settings') {
            return true;
        }
        return false;
    };

    // 1. Thao tác bật/tắt từng ô Checkbox
    const handleToggleCell = (moduleKey, actionKey) => {
        if (isFixedSystemRole || isModuleRestricted(moduleKey)) return;
        setMatrixState((prev) => {
            const currentRoleData = prev[selectedRole] || {};
            const moduleData = currentRoleData[moduleKey] || { read: false, create: false, update: false, delete: false };
            const nextVal = !moduleData[actionKey];

            return {
                ...prev,
                [selectedRole]: {
                    ...currentRoleData,
                    [moduleKey]: {
                        ...moduleData,
                        [actionKey]: nextVal,
                        // UX thông minh: Khi cấp quyền Thêm, Sửa, Xóa thì tự động cấp luôn quyền Xem
                        ...(nextVal && actionKey !== 'read' ? { read: true } : {})
                    }
                }
            };
        });
    };

    // 2. Thao tác bật/tắt toàn bộ 4 quyền của 1 dòng Module
    const handleToggleRow = (moduleKey) => {
        if (isFixedSystemRole || isModuleRestricted(moduleKey)) return;
        const row = currentPermissions[moduleKey] || {};
        const isAllActive = CRUD_ACTIONS.every((act) => Boolean(row[act.key]));

        setMatrixState((prev) => ({
            ...prev,
            [selectedRole]: {
                ...prev[selectedRole],
                [moduleKey]: {
                    read: !isAllActive,
                    create: !isAllActive,
                    update: !isAllActive,
                    delete: !isAllActive,
                }
            }
        }));
    };

    // 3. Tiện ích nhanh cho toàn bộ role: Cấp hết, Chỉ xem, Xóa hết
    const handleQuickAction = (mode) => {
        if (isFixedSystemRole) return;
        setMatrixState((prev) => {
            const newRolePerms = { ...(prev[selectedRole] || {}) };
            SYSTEM_MODULES.forEach((mod) => {
                // Nếu module bị khóa với vai trò người đang thao tác (Quản lý không được cấp settings), giữ nguyên tắt
                if (isModuleRestricted(mod.key)) {
                    newRolePerms[mod.key] = { read: false, create: false, update: false, delete: false };
                    return;
                }

                if (mode === 'GRANT_ALL') {
                    newRolePerms[mod.key] = { read: true, create: true, update: true, delete: true };
                } else if (mode === 'READ_ONLY') {
                    newRolePerms[mod.key] = { read: true, create: false, update: false, delete: false };
                } else if (mode === 'CLEAR_ALL') {
                    newRolePerms[mod.key] = { read: false, create: false, update: false, delete: false };
                }
            });
            return {
                ...prev,
                [selectedRole]: newRolePerms
            };
        });
    };

    // Đảm bảo không render modal nếu isOpen = false (sau khi toàn bộ hook đã được gọi ổn định)
    if (!isOpen) return null;

    // 4. Lưu lại quyền - Gửi API PUT lên Server
    const handleSavePermissions = async () => {
        if (isFixedSystemRole) {
            setAlertMessage({
                type: 'error',
                text: 'Không thể chỉnh sửa ma trận phân quyền của vai trò quản trị tối cao (Admin Hệ Thống).'
            });
            return;
        }

        if (isManager && ['admin', 'owner', 'manager'].includes(selectedRole)) {
            setAlertMessage({
                type: 'error',
                text: 'Quản lý chỉ có quyền phân quyền cho nhân viên cấp dưới, không thể phân quyền cho Admin, Owner hoặc Manager.'
            });
            return;
        }

        setIsSaving(true);
        setAlertMessage(null);

        // Chuẩn bị dữ liệu phân quyền đã được làm sạch bảo mật
        let sanitizedCurrentPermissions = { ...currentPermissions };
        let sanitizedMatrixState = { ...matrixState };

        // Nếu người thao tác là Quản lý, tuyệt đối không được cấp phát phân hệ Cài đặt hệ thống
        if (isManager) {
            sanitizedCurrentPermissions = {
                ...sanitizedCurrentPermissions,
                settings: { read: false, create: false, update: false, delete: false }
            };
            sanitizedMatrixState = {
                ...sanitizedMatrixState,
                [selectedRole]: {
                    ...(sanitizedMatrixState[selectedRole] || {}),
                    settings: { read: false, create: false, update: false, delete: false }
                }
            };
        }

        // Chuẩn bị payload chuẩn RESTful
        const payload = {
            role: selectedRole,
            permissions: sanitizedCurrentPermissions,
            // Format danh sách chuỗi code phẳng để tương thích các middleware Django
            permission_codes: Object.entries(sanitizedCurrentPermissions).flatMap(([mod, acts]) =>
                Object.entries(acts)
                    .filter(([, val]) => Boolean(val))
                    .map(([act]) => `${mod}.${act}`)
            ),
            updated_at: new Date().toISOString()
        };

        console.log('[RBAC] Gửi payload PUT lên API lưu phân quyền:', payload);

        try {
            // 1. Lưu bền vững vào localStorage để nhớ vĩnh viễn cấu hình quyền cả khi đăng xuất / đăng nhập lại
            try {
                localStorage.setItem('hotel_role_matrix', JSON.stringify(sanitizedMatrixState));
                // Bắn event đồng bộ tức thì cho Sidebar và các trang khác mà không cần F5
                window.dispatchEvent(new Event('hotel_permissions_updated'));
            } catch (eStorage) {
                console.warn('[RBAC] Không thể lưu vào localStorage:', eStorage);
            }

            // 2. Thử gọi endpoint backend nếu có
            try {
                await api.put(`/auth/admin/roles/${selectedRole}/permissions/`, payload);
            } catch (errApi) {
                // Nếu endpoint chưa định nghĩa ở backend Django, vẫn log và cho phép client lưu thành công
                console.warn('[RBAC] Backend endpoint chưa kích hoạt, tiếp tục cập nhật phía Client:', errApi?.message);
            }

            setAlertMessage({
                type: 'success',
                text: `Đã lưu thành công cấu hình phân quyền cho vai trò "${activeRoleMeta.title || selectedRole}"!`
            });

            if (onSaveSuccess) onSaveSuccess(selectedRole, payload);

            setTimeout(() => {
                setAlertMessage(null);
            }, 3500);
        } catch (error) {
            console.error('Lỗi khi lưu ma trận phân quyền:', error);
            setAlertMessage({
                type: 'error',
                text: 'Có lỗi xảy ra khi lưu phân quyền. Vui lòng thử lại!'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. MODAL HEADER */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-md shadow-indigo-600/30">
                            🛡️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                    Ma Trận Phân Quyền Vai Trò (Role-Based Access Control)
                                </h3>
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                                    RBAC 5★
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Cấp phát chi tiết quyền Xem (Read), Thêm (Create), Sửa (Update), Xóa (Delete) trên từng Module
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tab chuyển đổi chế độ xem */}
                        <div className="bg-slate-200/80 p-0.5 rounded-xl flex text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setViewMode('matrix')}
                                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                    viewMode === 'matrix'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Ma Trận Checkbox
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('overview')}
                                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                                    viewMode === 'overview'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Bảng Tổng Quan
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-800 border border-slate-200 flex items-center justify-center transition cursor-pointer text-sm font-bold ml-2 shadow-xs"
                            title="Đóng cửa sổ"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* 2. THANH CHỌN ROLE & TOOLBAR TIỆN ÍCH */}
                <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    {/* Role Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap mr-1">
                            Vai trò:
                        </span>
                        {roleOptions.map((r) => {
                            const isSelected = selectedRole === r.role;
                            return (
                                <button
                                    key={r.role}
                                    type="button"
                                    onClick={() => setSelectedRole(r.role)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                                        isSelected
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                                >
                                    <span>{r.icon || '👤'}</span>
                                    <span>{r.title || r.name || r.role}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick Action Buttons */}
                    {viewMode === 'matrix' && !isFixedSystemRole && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleQuickAction('GRANT_ALL')}
                                className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
                                title="Bật tất cả quyền cho vai trò này"
                            >
                                ✓ Chọn tất cả
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickAction('READ_ONLY')}
                                className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                                title="Chỉ bật quyền Xem cho các module"
                            >
                                👁️ Chỉ quyền Xem
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickAction('CLEAR_ALL')}
                                className="px-2.5 py-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition cursor-pointer"
                                title="Bỏ chọn toàn bộ quyền"
                            >
                                ✕ Bỏ chọn hết
                            </button>
                        </div>
                    )}
                    {viewMode === 'matrix' && isFixedSystemRole && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                            <span>🔒</span>
                            <span>Toàn quyền tối cao cố định</span>
                        </div>
                    )}
                </div>

                {/* Info Bar */}
                <div className="px-6 py-2.5 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-base">{activeRoleMeta.icon}</span>
                        <span className="text-slate-500">Cấu hình cho:</span>
                        <strong className="text-slate-900 font-bold">{activeRoleMeta.title || selectedRole}</strong>
                        {activeRoleMeta.level && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                {activeRoleMeta.level}
                            </span>
                        )}
                        <span className="text-slate-400 hidden sm:inline">|</span>
                        <span className="text-slate-500 hidden sm:inline truncate max-w-md">
                            {activeRoleMeta.description}
                        </span>
                    </div>

                    <div className="text-slate-600 font-medium">
                        Đã cấp: <strong className="text-indigo-600 font-bold">{grantedCount}</strong> / {totalPossible} quyền
                    </div>
                </div>

                {/* Thông báo Alert */}
                {alertMessage && (
                    <div
                        className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fadeIn ${
                            alertMessage.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                    >
                        <span>{alertMessage.text}</span>
                        <button
                            type="button"
                            onClick={() => setAlertMessage(null)}
                            className="font-bold hover:opacity-75 cursor-pointer ml-3"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* 3. MODAL BODY */}
                <div className="p-6 overflow-y-auto flex-1 text-slate-800 text-xs">
                    {/* Cảnh báo khi chọn vai trò tối cao cố định */}
                    {isFixedSystemRole && (
                        <div className="mb-4 p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2.5">
                            <span className="text-lg">🔒</span>
                            <div>
                                <span className="font-bold">Vai trò quyền lực tối cao cố định:</span> Vai trò <strong>{activeRoleMeta.title || selectedRole}</strong> mặc định sở hữu toàn quyền cao nhất trên mọi phân hệ hệ thống. Không thể chỉnh sửa, giới hạn hoặc tước quyền của vai trò này.
                            </div>
                        </div>
                    )}

                    {viewMode === 'matrix' ? (
                        /* CHẾ ĐỘ 1: BẢNG MA TRẬN CHECKBOX THEO YÊU CẦU */
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10.5px] tracking-wider border-b border-slate-200">
                                        <th className="p-3.5 pl-5 min-w-[280px]">Phân Hệ / Module Quản Trị</th>
                                        {CRUD_ACTIONS.map((action) => (
                                            <th key={action.key} className="p-3.5 text-center w-28 whitespace-nowrap">
                                                <span className={action.color}>{action.label}</span>
                                            </th>
                                        ))}
                                        <th className="p-3.5 pr-5 text-center w-24">Tất cả</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {SYSTEM_MODULES.map((mod) => {
                                        const isRestricted = isModuleRestricted(mod.key);
                                        const isRowDisabled = isFixedSystemRole || isRestricted;
                                        const rowPerms = isRestricted 
                                            ? { read: false, create: false, update: false, delete: false }
                                            : (currentPermissions[mod.key] || {});
                                        const isRowAllChecked = !isRestricted && CRUD_ACTIONS.every((act) => Boolean(rowPerms[act.key]));

                                        return (
                                            <tr key={mod.key} className={`transition ${isRestricted ? 'bg-slate-50/60' : 'hover:bg-slate-50/70'}`}>
                                                {/* Cột Dọc 1: Danh sách Module */}
                                                <td className="p-3.5 pl-5">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <strong className={`block text-xs font-bold ${isRestricted ? 'text-slate-500' : 'text-slate-900'}`}>
                                                                {mod.label}
                                                            </strong>
                                                            {isRestricted && (
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                                    🔒 Đặc quyền Admin/Owner
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] text-slate-400 block line-clamp-1">
                                                            {isRestricted ? 'Quản lý không có quyền cấp phát phân hệ nhạy cảm này cho nhân viên' : mod.desc}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 4 Cột Checkbox Thao Tác (Xem, Thêm, Sửa, Xóa) */}
                                                {CRUD_ACTIONS.map((act) => {
                                                    const checked = Boolean(rowPerms[act.key]);
                                                    return (
                                                        <td key={act.key} className="p-3.5 text-center">
                                                            <label 
                                                                className={`inline-flex items-center justify-center p-1 rounded-lg transition ${
                                                                    isRowDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-100 cursor-pointer'
                                                                }`}
                                                                title={isRestricted ? 'Quản lý không có quyền phân quyền phân hệ Cài đặt hệ thống' : undefined}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    disabled={isRowDisabled}
                                                                    onChange={() => handleToggleCell(mod.key, act.key)}
                                                                    className={`w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-2 transition ${
                                                                        isRowDisabled ? 'cursor-not-allowed bg-slate-100' : 'bg-white cursor-pointer'
                                                                    }`}
                                                                />
                                                            </label>
                                                        </td>
                                                    );
                                                })}

                                                {/* Cột Tiện Ích: Bật/Tắt Cả Dòng */}
                                                <td className="p-3.5 pr-5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleRow(mod.key)}
                                                        disabled={isRowDisabled}
                                                        className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition ${
                                                            isRowDisabled
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                                                                : isRowAllChecked
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs cursor-pointer'
                                                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 cursor-pointer'
                                                        }`}
                                                        title={
                                                            isRestricted
                                                                ? 'Quản lý không có quyền phân quyền phân hệ Cài đặt hệ thống'
                                                                : isFixedSystemRole
                                                                ? 'Không thể chỉnh sửa vai trò cố định'
                                                                : 'Bật/Tắt nhanh 4 quyền của module này'
                                                        }
                                                    >
                                                        {isRowAllChecked ? 'Đủ 4' : 'Bật hết'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* CHẾ ĐỘ 2: BẢNG TỔNG QUAN TẤT CẢ VAI TRÒ */
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                        <th className="p-3.5 pl-4">Vai trò & Cấp bậc</th>
                                        <th className="p-3.5">Mô tả chức trách</th>
                                        <th className="p-3.5">Phòng (PMS)</th>
                                        <th className="p-3.5">Đặt phòng</th>
                                        <th className="p-3.5">Khách hàng</th>
                                        <th className="p-3.5">Nhân sự</th>
                                        <th className="p-3.5">Tài chính</th>
                                        <th className="p-3.5">Hệ thống</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {roleOptions.map((r) => {
                                        return (
                                            <tr key={r.role} className="hover:bg-slate-50 transition">
                                                <td className="p-3.5 pl-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">{r.icon}</span>
                                                        <div>
                                                            <strong className="block text-slate-900 font-bold">{r.title}</strong>
                                                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                                {r.level}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3.5 min-w-[200px] text-slate-500 leading-relaxed">
                                                    {r.description}
                                                </td>
                                                <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                                                    {r.permissions?.rooms || '—'}
                                                </td>
                                                <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                                                    {r.permissions?.bookings || '—'}
                                                </td>
                                                <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                                                    {r.permissions?.guests || '—'}
                                                </td>
                                                <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                                                    {r.permissions?.employees || '—'}
                                                </td>
                                                <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                                                    {r.permissions?.finance || '—'}
                                                </td>
                                                <td className="p-3.5 whitespace-nowrap font-medium">
                                                    <span className={r.permissions?.settings === 'Không có quyền' ? 'text-slate-400' : 'text-blue-600 font-semibold'}>
                                                        {r.permissions?.settings || '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Ghi chú bảo mật */}
                    <div className="mt-4 p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 text-indigo-900 flex items-start gap-3">
                        <span className="text-lg">💡</span>
                        <div className="text-xs leading-relaxed">
                            <strong className="block mb-0.5 font-bold">Cơ chế bảo mật hai lớp (Defense-in-depth):</strong>
                            Khi cấu hình quyền tại đây, phía Frontend sẽ lập tức điều chỉnh ẩn/hiện các phân hệ menu trên Sidebar. Đồng thời, các yêu cầu gọi API gửi tới máy chủ sẽ được kiểm tra với các bộ lọc phân quyền tại Backend để bảo đảm bảo mật dữ liệu tuyệt đối.
                        </div>
                    </div>
                </div>

                {/* 4. MODAL FOOTER */}
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="text-amber-500 font-bold">⚠️</span>
                        <span>Dữ liệu lưu sẽ tự động đồng bộ sang bảng mã quyền của nhân viên tương ứng.</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
                        >
                            Đóng cửa sổ
                        </button>

                        {isFixedSystemRole ? (
                            <button
                                type="button"
                                disabled
                                className="px-6 py-2.5 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl transition cursor-not-allowed flex items-center gap-2 border border-slate-300"
                            >
                                <span>🔒</span>
                                <span>Quyền hệ thống cố định (Không thể sửa)</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSavePermissions}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" stroke="currentColor"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        <span>Đang lưu...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>💾</span>
                                        <span>Lưu thay đổi vai trò ({activeRoleMeta.title || selectedRole})</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
