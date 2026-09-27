import React, { useState, useEffect } from 'react';
import adminUserService from '../../services/adminUserService';
import RoleMatrixModal from './RoleMatrixModal';
import UserAvatar from '../common/UserAvatar';

export default function EmployeeManagement() {
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Bộ lọc
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals
    const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);
    const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Form gán vai trò
    const [assignedRole, setAssignedRole] = useState('');

    // Form Chỉnh sửa nhân viên
    const [editFormData, setEditFormData] = useState({
        full_name: '',
        email: '',
        phone_number: '',
        address: '',
        employee_code: '',
        department: '',
        position: '',
        shift: '',
        salary_base: '',
        hire_date: '',
        is_active: true,
    });

    // Form Tạo mới nhân viên
    const [createFormData, setCreateFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: 'Password123',
        role: 'receptionist',
        employee_code: '',
        department: 'Lễ Tân & Tiền Sảnh',
        position: 'Nhân viên Lễ tân',
        shift: 'Ca Xoay (Linh Hoạt)',
        salary_base: '11000000',
        hire_date: new Date().toISOString().split('T')[0],
    });

    const [alertMessage, setAlertMessage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Lấy dữ liệu nhân sự
    const fetchEmployees = async () => {
        setIsLoading(true);
        const params = {};
        if (searchTerm) params.q = searchTerm;
        if (roleFilter !== 'all') params.role = roleFilter;
        if (departmentFilter !== 'all') params.department = departmentFilter;
        if (statusFilter !== 'all') params.is_active = statusFilter;

        const res = await adminUserService.getEmployees(params);
        if (res.success) {
            setEmployees(res.employees || []);
            if (res.roles) setRoles(res.roles);
            if (res.departments) setDepartments(res.departments);
            if (res.shifts) setShifts(res.shifts);
        }
        setIsLoading(false);
    };

    // Load ban đầu & khi thay đổi bộ lọc select
    useEffect(() => {
        fetchEmployees();
    }, [roleFilter, departmentFilter, statusFilter]);

    // Tìm kiếm
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchEmployees();
    };

    // Mở modal phân quyền
    const handleOpenAssignRole = (emp) => {
        setSelectedEmployee(emp);
        setAssignedRole(emp.role);
        setIsAssignRoleModalOpen(true);
    };

    // Lưu phân quyền vai trò
    const handleSaveRole = async (e) => {
        e.preventDefault();
        if (!selectedEmployee || !assignedRole) return;
        setIsSubmitting(true);

        const res = await adminUserService.updateEmployee(selectedEmployee.id, {
            role: assignedRole,
        });

        setIsSubmitting(false);
        if (res.success) {
            setIsAssignRoleModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Đã cập nhật phân quyền thành công cho nhân viên ${selectedEmployee.full_name || selectedEmployee.username}!`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể cập nhật phân quyền. Vui lòng thử lại.',
            });
        }
    };

    // Mở modal sửa thông tin nhân viên
    const handleOpenEdit = (emp) => {
        setSelectedEmployee(emp);
        setEditFormData({
            full_name: emp.full_name || '',
            email: emp.email || '',
            phone_number: emp.phone_number || '',
            address: emp.address || '',
            employee_code: emp.employee_profile?.employee_code || '',
            department: emp.employee_profile?.department || '',
            position: emp.employee_profile?.position || '',
            shift: emp.employee_profile?.shift || '',
            salary_base: emp.employee_profile?.salary_base || '',
            hire_date: emp.employee_profile?.hire_date || '',
            is_active: emp.is_active,
        });
        setIsEditModalOpen(true);
    };

    // Lưu chỉnh sửa nhân viên
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const res = await adminUserService.updateEmployee(selectedEmployee.id, editFormData);
        setIsSubmitting(false);

        if (res.success) {
            setIsEditModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Cập nhật hồ sơ nhân viên ${res.employee.full_name} thành công!`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Có lỗi xảy ra khi lưu thông tin.',
            });
        }
    };

    // Mở modal tạo mới nhân viên
    const handleOpenCreate = () => {
        setCreateFormData({
            fullName: '',
            email: '',
            phone: '',
            password: 'Password123',
            role: 'receptionist',
            employee_code: `NV-${Math.floor(1000 + Math.random() * 9000)}`,
            department: 'Lễ Tân & Tiền Sảnh',
            position: 'Nhân viên Lễ tân',
            shift: 'Ca Xoay (Linh Hoạt)',
            salary_base: '11000000',
            hire_date: new Date().toISOString().split('T')[0],
        });
        setIsCreateModalOpen(true);
    };

    // Tạo mới nhân viên
    const handleCreateEmployee = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const res = await adminUserService.createEmployee(createFormData);
        setIsSubmitting(false);

        if (res.success) {
            setIsCreateModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Đã tạo mới nhân viên "${res.employee?.full_name}" thành công! Mật khẩu khởi tạo: ${createFormData.password}`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể tạo nhân viên mới. Vui lòng kiểm tra lại.',
            });
        }
    };

    // Khóa / Mở khóa tài khoản nhân viên
    const handleToggleStatus = async (emp) => {
        const actionText = emp.is_active ? 'khóa tài khoản' : 'kích hoạt lại';
        if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} của nhân viên "${emp.full_name || emp.username}"?`)) {
            return;
        }

        const res = await adminUserService.toggleEmployeeStatus(emp.id, !emp.is_active);
        if (res.success) {
            setAlertMessage({
                type: 'success',
                text: `Đã ${actionText} thành công!`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Thao tác không thành công.',
            });
        }
    };

    // Xóa nhân viên
    const handleDelete = async (emp) => {
        if (!window.confirm(`Hành động này sẽ xóa vĩnh viễn tài khoản nhân viên "${emp.full_name || emp.username}". Bạn có chắc chắn muốn tiếp tục?`)) {
            return;
        }

        const res = await adminUserService.deleteEmployee(emp.id);
        if (res.success) {
            setAlertMessage({
                type: 'success',
                text: `Đã xóa nhân viên thành công!`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể xóa tài khoản này.',
            });
        }
    };

    // Helper format tiền tệ
    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return '—';
        return Number(amount).toLocaleString('vi-VN') + ' ₫';
    };

    // Helper badge vai trò
    const getRoleBadge = (roleCode) => {
        const roleObj = roles.find((r) => r.code === roleCode);
        const name = roleObj ? roleObj.name : roleCode;
        const color = roleObj ? roleObj.color : 'slate';

        const styleMap = {
            purple: 'bg-purple-100 text-purple-800 border-purple-200',
            amber: 'bg-amber-100 text-amber-800 border-amber-200',
            blue: 'bg-blue-100 text-blue-800 border-blue-200',
            emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
            orange: 'bg-orange-100 text-orange-800 border-orange-200',
            rose: 'bg-rose-100 text-rose-800 border-rose-200',
            slate: 'bg-slate-100 text-slate-800 border-slate-200',
        };

        return (
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${styleMap[color] || styleMap.slate}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {name}
            </span>
        );
    };

    // Đếm số lượng theo nhóm
    const totalCount = employees.length;
    const activeCount = employees.filter((e) => e.is_active).length;
    const managementCount = employees.filter((e) => ['admin', 'owner', 'manager'].includes(e.role)).length;
    const operationsCount = employees.filter((e) => !['admin', 'owner', 'manager'].includes(e.role)).length;

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                            HUMAN RESOURCES & RBAC
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">Phân quyền chi tiết theo vai trò nội bộ</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Quản Lý Nhân Sự & Phân Quyền Vai Trò
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Kiểm soát danh sách cán bộ nhân viên, chức vụ, mức lương, lịch trực và phân quyền chức năng 8 vai trò tại Khách Sạn TA Đà Nẵng.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsRoleMatrixOpen(true)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
                    >
                        <span>🛡️</span>
                        <span>Ma Trận Phân Quyền</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-2"
                    >
                        <span>＋</span>
                        <span>Thêm Nhân Viên Mới</span>
                    </button>
                </div>
            </div>

            {/* Alert Message Toast */}
            {alertMessage && (
                <div
                    className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border transition ${
                        alertMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">{alertMessage.type === 'success' ? '✅' : '⚠️'}</span>
                        <span>{alertMessage.text}</span>
                    </div>
                    <button
                        onClick={() => setAlertMessage(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 4 Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            TỔNG NHÂN SỰ
                        </span>
                        <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
                        <span className="text-[11px] text-slate-500">Toàn bộ nhân sự khách sạn</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                        👥
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            ĐANG LÀM VIỆC
                        </span>
                        <div className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</div>
                        <span className="text-[11px] text-emerald-700 font-medium">Tài khoản hoạt động</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                        🟢
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            BAN QUẢN LÝ
                        </span>
                        <div className="text-2xl font-bold text-purple-600 mt-1">{managementCount}</div>
                        <span className="text-[11px] text-purple-700 font-medium">Admin • Owner • Manager</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                        👑
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            ĐỘI NGŨ VẬN HÀNH
                        </span>
                        <div className="text-2xl font-bold text-amber-600 mt-1">{operationsCount}</div>
                        <span className="text-[11px] text-amber-700 font-medium">Lễ tân • Thu ngân • Buồng phòng...</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
                        🛎️
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row items-center gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo Tên, Mã NV, Email, SĐT, Vị trí chức danh..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                        />
                    </div>

                    {/* Filter by Role */}
                    <div className="w-full lg:w-48">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-600 transition"
                        >
                            <option value="all">Tất cả vai trò ({roles.length})</option>
                            {roles.map((r) => (
                                <option key={r.code} value={r.code}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Department */}
                    <div className="w-full lg:w-48">
                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-600 transition"
                        >
                            <option value="all">Tất cả phòng ban</option>
                            {departments.map((dept) => (
                                <option key={dept} value={dept}>
                                    {dept}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Status */}
                    <div className="w-full lg:w-36">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-600 transition"
                        >
                            <option value="all">Mọi trạng thái</option>
                            <option value="true">Đang hoạt động</option>
                            <option value="false">Tạm khóa</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="w-full lg:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0"
                    >
                        Lọc dữ liệu
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setRoleFilter('all');
                            setDepartmentFilter('all');
                            setStatusFilter('all');
                        }}
                        className="w-full lg:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition shrink-0"
                        title="Đặt lại bộ lọc"
                    >
                        🔄
                    </button>
                </form>
            </div>

            {/* Employee Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900">
                            Danh Sách Nhân Viên Khách Sạn
                        </h3>
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                            {employees.length} Nhân sự
                        </span>
                    </div>
                    <span className="text-xs text-slate-400">
                        Cập nhật theo dữ liệu thực tế hệ thống
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="py-3 px-4">NHÂN VIÊN</th>
                                <th className="py-3 px-4">MÃ NV</th>
                                <th className="py-3 px-4">VAI TRÒ (RBAC)</th>
                                <th className="py-3 px-4">PHÒNG BAN & CHỨC DANH</th>
                                <th className="py-3 px-4">CA LÀM VIỆC & LƯƠNG</th>
                                <th className="py-3 px-4">TRẠNG THÁI</th>
                                <th className="py-3 px-4 text-right">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                                        <div>Đang tải dữ liệu nhân sự...</div>
                                    </td>
                                </tr>
                            ) : employees.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        Không tìm thấy nhân viên nào phù hợp với bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                employees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-blue-50/20 transition">
                                        {/* Avatar & Name */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar
                                                    avatar={emp.avatar}
                                                    name={emp.full_name || emp.username}
                                                    role={emp.role}
                                                    size="md"
                                                    border={false}
                                                />
                                                <div>
                                                    <div className="font-bold text-slate-900">
                                                        {emp.full_name || emp.username}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        {emp.email} • {emp.phone_number || 'Chưa cập nhật SĐT'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Employee Code */}
                                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                                            {emp.employee_profile?.employee_code || `NV-${emp.id}`}
                                        </td>

                                        {/* Role Badge */}
                                        <td className="py-3.5 px-4">
                                            {getRoleBadge(emp.role)}
                                        </td>

                                        {/* Department & Position */}
                                        <td className="py-3.5 px-4">
                                            <div className="font-semibold text-slate-800">
                                                {emp.employee_profile?.position || 'Nhân viên'}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {emp.employee_profile?.department || 'Chung'}
                                            </div>
                                        </td>

                                        {/* Shift & Salary */}
                                        <td className="py-3.5 px-4">
                                            <div className="text-slate-800 font-medium">
                                                {emp.employee_profile?.shift || 'Chưa xếp ca'}
                                            </div>
                                            <div className="text-[11px] font-bold text-emerald-600">
                                                {formatCurrency(emp.employee_profile?.salary_base)}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="py-3.5 px-4">
                                            {emp.is_active ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Hoạt động
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                    Đã khóa
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenAssignRole(emp)}
                                                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition flex items-center gap-1 border border-indigo-200"
                                                    title="Phân quyền vai trò chi tiết"
                                                >
                                                    <span>🛡️</span>
                                                    <span>Phân quyền</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEdit(emp)}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition"
                                                    title="Chỉnh sửa hồ sơ"
                                                >
                                                    ✏️ Sửa
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(emp)}
                                                    className={`px-2 py-1 rounded-lg font-medium text-[11px] transition ${
                                                        emp.is_active
                                                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                                    }`}
                                                    title={emp.is_active ? 'Khóa tài khoản' : 'Mở khóa'}
                                                >
                                                    {emp.is_active ? '🔒 Khóa' : '🔓 Mở'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(emp)}
                                                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium text-[11px] transition"
                                                    title="Xóa tài khoản"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MODAL 1: PHÂN QUYỀN VAI TRÒ CHI TIẾT THEO CHỨC NĂNG */}
            {/* ========================================================================= */}
            {isAssignRoleModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-xl">
                                    🛡️
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white">
                                        Phân Quyền Vai Trò Cho Nhân Viên
                                    </h3>
                                    <p className="text-xs text-slate-300">
                                        {selectedEmployee.full_name || selectedEmployee.username} (Mã: {selectedEmployee.employee_profile?.employee_code || selectedEmployee.id})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAssignRoleModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveRole} className="p-6 space-y-5 text-xs text-slate-800">
                            <div>
                                <label className="block font-bold text-slate-700 mb-2">
                                    Lựa chọn vai trò nội bộ (RBAC):
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                                    {roles.map((r) => {
                                        const isSelected = assignedRole === r.code;
                                        return (
                                            <div
                                                key={r.code}
                                                onClick={() => setAssignedRole(r.code)}
                                                className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                                                    isSelected
                                                        ? 'bg-blue-50/60 border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between mb-1.5">
                                                    <span className="font-bold text-sm text-slate-900">
                                                        {r.name}
                                                    </span>
                                                    <input
                                                        type="radio"
                                                        name="roleOption"
                                                        checked={isSelected}
                                                        onChange={() => setAssignedRole(r.code)}
                                                        className="text-blue-600 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">
                                                    {r.description}
                                                </p>
                                                <div className="flex flex-wrap gap-1 text-[9px] font-bold">
                                                    {r.permissions?.rooms && (
                                                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                                            Phòng: {r.permissions.rooms}
                                                        </span>
                                                    )}
                                                    {r.permissions?.bookings && (
                                                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                                            Booking: {r.permissions.bookings}
                                                        </span>
                                                    )}
                                                    {r.permissions?.finance && (
                                                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                                            Thu chi: {r.permissions.finance}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cảnh báo cấp quyền quản trị */}
                            {['admin', 'owner', 'manager'].includes(assignedRole) && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                                    <span>⚠️</span>
                                    <div>
                                        <strong>Cảnh báo vai trò quản lý cấp cao:</strong> Vai trò này sẽ cho phép nhân viên có quyền truy cập vào cổng quản trị <strong>AdminDashboard</strong> và kiểm soát dữ liệu tài chính, khách hàng và phòng ban của toàn khách sạn.
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setIsRoleMatrixOpen(true)}
                                    className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                                >
                                    <span>🛡️</span>
                                    <span>Xem chi tiết ma trận toàn quyền</span>
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAssignRoleModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Đang lưu...' : 'Xác Nhận Phân Quyền'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: CHỈNH SỬA THÔNG TIN HỒ SƠ NHÂN VIÊN */}
            {/* ========================================================================= */}
            {isEditModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl">
                                    ✏️
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white">
                                        Chỉnh Sửa Hồ Sơ Nhân Viên
                                    </h3>
                                    <p className="text-xs text-slate-300">
                                        {selectedEmployee.full_name || selectedEmployee.username}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Họ và tên *</label>
                                    <input
                                        type="text"
                                        value={editFormData.full_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Mã Nhân Viên *</label>
                                    <input
                                        type="text"
                                        value={editFormData.employee_code}
                                        onChange={(e) => setEditFormData({ ...editFormData, employee_code: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Email liên hệ *</label>
                                    <input
                                        type="email"
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại *</label>
                                    <input
                                        type="tel"
                                        value={editFormData.phone_number}
                                        onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Phòng ban</label>
                                    <select
                                        value={editFormData.department}
                                        onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    >
                                        {departments.map((dept) => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Chức danh / Vị trí</label>
                                    <input
                                        type="text"
                                        value={editFormData.position}
                                        onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ca làm việc</label>
                                    <select
                                        value={editFormData.shift}
                                        onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    >
                                        {shifts.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Lương cơ bản (VND)</label>
                                    <input
                                        type="number"
                                        value={editFormData.salary_base}
                                        onChange={(e) => setEditFormData({ ...editFormData, salary_base: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ngày vào làm</label>
                                    <input
                                        type="date"
                                        value={editFormData.hire_date || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, hire_date: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Trạng thái làm việc</label>
                                    <select
                                        value={editFormData.is_active ? 'active' : 'inactive'}
                                        onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'active' })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    >
                                        <option value="active">Đang hoạt động</option>
                                        <option value="inactive">Đang tạm khóa / Nghỉ việc</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Địa chỉ thường trú</label>
                                <input
                                    type="text"
                                    value={editFormData.address}
                                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    placeholder="Ví dụ: 128 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Đang lưu...' : 'Lưu Hồ Sơ Nhân Viên'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: THÊM MỚI NHÂN VIÊN VÀ PHÂN QUYỀN KHỞI TẠO */}
            {/* ========================================================================= */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl">
                                    ＋
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white">
                                        Thêm Mới Nhân Viên & Tài Khoản Nội Bộ
                                    </h3>
                                    <p className="text-xs text-slate-300">
                                        Khởi tạo tài khoản đăng nhập và phân quyền vai trò
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateEmployee} className="p-6 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Họ và tên *</label>
                                    <input
                                        type="text"
                                        placeholder="Ví dụ: Nguyễn Văn An"
                                        value={createFormData.fullName}
                                        onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Mã Nhân Viên *</label>
                                    <input
                                        type="text"
                                        value={createFormData.employee_code}
                                        onChange={(e) => setCreateFormData({ ...createFormData, employee_code: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Email đăng nhập *</label>
                                    <input
                                        type="email"
                                        placeholder="an.nguyen@tadanang.vn"
                                        value={createFormData.email}
                                        onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại *</label>
                                    <input
                                        type="tel"
                                        placeholder="0905123456"
                                        value={createFormData.phone}
                                        onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Mật khẩu khởi tạo *</label>
                                    <input
                                        type="text"
                                        value={createFormData.password}
                                        onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Vai trò hệ thống (RBAC) *</label>
                                    <select
                                        value={createFormData.role}
                                        onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-bold text-blue-700"
                                    >
                                        {roles.map((r) => (
                                            <option key={r.code} value={r.code}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Phòng ban</label>
                                    <select
                                        value={createFormData.department}
                                        onChange={(e) => setCreateFormData({ ...createFormData, department: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    >
                                        {departments.map((dept) => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Chức danh</label>
                                    <input
                                        type="text"
                                        value={createFormData.position}
                                        onChange={(e) => setCreateFormData({ ...createFormData, position: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ca làm việc</label>
                                    <select
                                        value={createFormData.shift}
                                        onChange={(e) => setCreateFormData({ ...createFormData, shift: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    >
                                        {shifts.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Lương cơ bản (VND)</label>
                                    <input
                                        type="number"
                                        value={createFormData.salary_base}
                                        onChange={(e) => setCreateFormData({ ...createFormData, salary_base: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Đang tạo...' : 'Tạo Tài Khoản Nhân Viên'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Ma Trận Phân Quyền */}
            <RoleMatrixModal
                isOpen={isRoleMatrixOpen}
                onClose={() => setIsRoleMatrixOpen(false)}
                roles={roles}
            />
        </div>
    );
}
