import React, { useState, useEffect, useRef, useMemo } from 'react';
import adminUserService from '../../services/adminUserService';
import RoleMatrixModal from '../../components/admin/modals/RoleMatrixModal';
import { DEFAULT_ROLE_MATRIX } from '../../data/roleMatrixData';
import UserAvatar from '../../components/common/UserAvatar';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../store/authStore';

// =========================================================================
// DANH MỤC PHÒNG BAN, CHỨC DANH & CA LÀM VIỆC CHUẨN KHÁCH SẠN 5 SAO
// =========================================================================
const HOTEL_DEPARTMENTS = [
    {
        name: 'Ban Quản Lý & Điều Hành',
        codePrefix: 'NV-MGR',
        defaultRole: 'manager',
        positions: [
            'Tổng Giám Đốc (General Manager)',
            'Phó Giám Đốc Điều Hành (Operations Director)',
            'Quản Trị Viên Hệ Thống (System Admin)',
            'Trợ Lý Giám Đốc (Executive Assistant)',
            'Giám Đốc Nhân Sự (HR Director)',
        ]
    },
    {
        name: 'Lễ Tân & Tiền Sảnh',
        codePrefix: 'NV-REC',
        defaultRole: 'receptionist',
        positions: [
            'Trưởng Bộ Phận Tiền Sảnh (Front Office Manager)',
            'Giám Sát Lễ Tân (Front Desk Supervisor)',
            'Nhân Viên Lễ Tân (Receptionist)',
            'Nhân Viên Chăm Sóc Khách Hàng (Concierge)',
            'Nhân Viên Đón Tiếp & Hành Lý (Bellman)',
        ]
    },
    {
        name: 'Kế Toán & Thu Ngân',
        codePrefix: 'NV-CAS',
        defaultRole: 'cashier',
        positions: [
            'Kế Toán Trưởng (Chief Accountant)',
            'Kế Toán Tổng Hợp',
            'Nhân Viên Thu Ngân Khách Sạn (Cashier)',
            'Kiểm Toán Đêm (Night Auditor)',
            'Thủ Quỹ Khách Sạn',
        ]
    },
    {
        name: 'Buồng Phòng & Vệ Sinh',
        codePrefix: 'NV-HSK',
        defaultRole: 'housekeeper',
        positions: [
            'Trưởng Bộ Phận Buồng Phòng (Executive Housekeeper)',
            'Giám Sát Tầng (Floor Supervisor)',
            'Nhân Viên Dọn Phòng (Housekeeper)',
            'Nhân Viên Giặt Là & Đồng Phục (Laundry Staff)',
            'Nhân Viên Vệ Sinh Khu Vực Công Cộng (PA)',
        ]
    },
    {
        name: 'Ẩm Thực & Nhà Hàng (F&B)',
        codePrefix: 'NV-SRV',
        defaultRole: 'service_staff',
        positions: [
            'Quản Lý Nhà Hàng & Ẩm Thực (F&B Manager)',
            'Bếp Trưởng Điều Hành (Executive Chef)',
            'Trưởng Ca Nhà Hàng',
            'Nhân Viên Phục Vụ Bàn (Waitstaff)',
            'Nhân Viên Pha Chế (Bartender/Barista)',
            'Nhân Viên Phục Vụ Tại Phòng (Room Service)',
        ]
    },
    {
        name: 'Dịch Vụ Spa & Chăm Sóc Sức Khỏe',
        codePrefix: 'NV-SPA',
        defaultRole: 'service_staff',
        positions: [
            'Quản Lý Spa & Trị Liệu (Spa Manager)',
            'Chuyên Viên Trị Liệu & Massage',
            'Kỹ Thuật Viên Chăm Sóc Da & Trị Liệu',
            'Lễ Tân Spa & Tư Vấn Khách Hàng',
        ]
    },
    {
        name: 'Kỹ Thuật & Bảo Trì Cơ Điện',
        codePrefix: 'NV-TEC',
        defaultRole: 'technician',
        positions: [
            'Kỹ Sư Trưởng (Chief Engineer)',
            'Giám Sát Kỹ Thuật Bảo Trì',
            'Kỹ Thuật Viên Điện Lạnh & Điều Hòa',
            'Kỹ Thuật Viên Điện Nước & PCCC',
            'Kỹ Thuật Viên IT & Hệ Thống Mạng',
        ]
    },
    {
        name: 'An Ninh & Bảo Vệ Khách Sạn',
        codePrefix: 'NV-SEC',
        defaultRole: 'service_staff',
        positions: [
            'Đội Trưởng Đội An Ninh Khách Sạn',
            'Giám Sát An Ninh & PCCC',
            'Nhân Viên An Ninh Tiền Sảnh',
            'Nhân Viên Trực Camera & Bãi Xe',
        ]
    }
];

const HOTEL_SHIFTS = [
    'Ca Sáng (06:00 - 14:00)',
    'Ca Chiều (14:00 - 22:00)',
    'Ca Đêm (22:00 - 06:00 hôm sau)',
    'Ca Hành Chính (08:00 - 17:00)',
    'Ca Gãy / Linh Hoạt (10:00 - 14:00 & 18:00 - 22:00)',
    'Ca Xoay (Linh hoạt 3 ca theo tuần)',
];

export default function EmployeeManagement() {
    const { user: currentUser } = useAuth();
    const currentUserRole = currentUser?.role || '';
    const isManager = currentUserRole === 'manager';

    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState(DEFAULT_ROLE_MATRIX);
    const [isLoading, setIsLoading] = useState(true);

    // Danh sách vai trò có thể thao tác (Quản lý không được can thiệp vào Admin/Owner/Manager)
    const availableRoles = useMemo(() => {
        if (isManager) {
            return roles.filter((r) => !['admin', 'owner', 'manager'].includes(r.code || r.role));
        }
        return roles;
    }, [roles, isManager]);

    // Phân trang (Pagination)
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const currentPageRef = useRef(currentPage);
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    // Bộ lọc
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [shiftFilter, setShiftFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals
    const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);
    const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Form phân quyền vai trò (Role Assignment)
    const [assignRoleData, setAssignRoleData] = useState({
        role: '',
        department: '',
        position: '',
        shift: '',
        autoSync: true,
    });

    // Form Chỉnh sửa nhân viên
    const [editFormData, setEditFormData] = useState({
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

    // Form Tạo mới nhân viên
    const [createFormData, setCreateFormData] = useState({
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

    const [alertMessage, setAlertMessage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Lấy danh sách chức danh khả dụng theo phòng ban được chọn
    const getPositionsByDepartment = (deptName) => {
        const found = HOTEL_DEPARTMENTS.find((d) => d.name === deptName);
        return found ? found.positions : ['Nhân viên'];
    };

    // Tự động tạo mã nhân viên gợi ý theo phòng ban
    const generateEmployeeCode = (deptName) => {
        const found = HOTEL_DEPARTMENTS.find((d) => d.name === deptName);
        const prefix = found ? found.codePrefix : 'NV';
        const randomNum = Math.floor(100 + Math.random() * 900);
        return `${prefix}${randomNum}`;
    };

    // Lấy dữ liệu nhân sự từ backend
    const fetchEmployees = async (page = null) => {
        setIsLoading(true);
        const targetPage = page !== null ? page : currentPageRef.current;
        const params = { page: targetPage };
        if (searchTerm) params.q = searchTerm;
        if (roleFilter !== 'all') params.role = roleFilter;
        if (departmentFilter !== 'all') params.department = departmentFilter;
        if (statusFilter !== 'all') params.is_active = statusFilter;

        const res = await adminUserService.getEmployees(params);
        if (res.success) {
            let list = res.results || res.employees || [];
            // Lọc theo ca làm việc ở frontend nếu có chọn
            if (shiftFilter !== 'all') {
                list = list.filter((e) => e.employee_profile?.shift === shiftFilter);
            }
            setEmployees(list);
            setTotalCount(res.count !== undefined ? res.count : list.length);
            setTotalPages(res.total_pages || Math.ceil((res.count || list.length) / 10) || 1);
            if (res.roles) setRoles(res.roles);
        }
        setIsLoading(false);
    };

    // Load khi bộ lọc thay đổi -> reset về trang 1
    useEffect(() => {
        setCurrentPage(1);
        fetchEmployees(1);
    }, [roleFilter, departmentFilter, shiftFilter, statusFilter]);

    // Xử lý chuyển trang
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        fetchEmployees(newPage);
    };

    // Nạp thêm chi tiết bảng ma trận phân quyền vai trò từ API
    useEffect(() => {
        const loadRoles = async () => {
            const roleRes = await adminUserService.getRoles();
            if (roleRes.success && roleRes.roles && roleRes.roles.length > 0) {
                setRoles(roleRes.roles);
            }
        };
        loadRoles();
    }, []);

    // Tìm kiếm
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchEmployees(1);
    };

    // =========================================================================
    // 1. CHỨC NĂNG THÊM MỚI NHÂN VIÊN
    // =========================================================================
    const handleOpenCreate = () => {
        const defaultDept = 'Lễ Tân & Tiền Sảnh';
        const positions = getPositionsByDepartment(defaultDept);
        setCreateFormData({
            fullName: '',
            email: '',
            phone: '',
            password: 'Password123',
            role: 'receptionist',
            employee_code: generateEmployeeCode(defaultDept),
            department: defaultDept,
            position: positions[0] || 'Nhân Viên Lễ Tân (Receptionist)',
            shift: 'Ca Sáng (06:00 - 14:00)',
            salary_base: '11000000',
            hire_date: new Date().toISOString().split('T')[0],
            customPosition: false,
        });
        setIsCreateModalOpen(true);
    };

    // Khi đổi vai trò trong form thêm mới: tự động gợi ý phòng ban & chức danh
    const handleCreateRoleChange = (newRole) => {
        let suggestedDept = 'Lễ Tân & Tiền Sảnh';
        let suggestedShift = 'Ca Sáng (06:00 - 14:00)';
        let suggestedSalary = '10000000';

        switch (newRole) {
            case 'admin':
                suggestedDept = 'Ban Quản Lý & Điều Hành';
                suggestedShift = 'Ca Hành Chính (08:00 - 17:00)';
                suggestedSalary = '30000000';
                break;
            case 'owner':
                suggestedDept = 'Ban Quản Lý & Điều Hành';
                suggestedShift = 'Ca Hành Chính (08:00 - 17:00)';
                suggestedSalary = '45000000';
                break;
            case 'manager':
                suggestedDept = 'Ban Quản Lý & Điều Hành';
                suggestedShift = 'Ca Hành Chính (08:00 - 17:00)';
                suggestedSalary = '25000000';
                break;
            case 'receptionist':
                suggestedDept = 'Lễ Tân & Tiền Sảnh';
                suggestedShift = 'Ca Sáng (06:00 - 14:00)';
                suggestedSalary = '11000000';
                break;
            case 'cashier':
                suggestedDept = 'Kế Toán & Thu Ngân';
                suggestedShift = 'Ca Xoay (Linh hoạt 3 ca theo tuần)';
                suggestedSalary = '12000000';
                break;
            case 'housekeeper':
                suggestedDept = 'Buồng Phòng & Vệ Sinh';
                suggestedShift = 'Ca Sáng (06:00 - 14:00)';
                suggestedSalary = '9500000';
                break;
            case 'service_staff':
                suggestedDept = 'Ẩm Thực & Nhà Hàng (F&B)';
                suggestedShift = 'Ca Chiều (14:00 - 22:00)';
                suggestedSalary = '10000000';
                break;
            case 'technician':
                suggestedDept = 'Kỹ Thuật & Bảo Trì Cơ Điện';
                suggestedShift = 'Ca Xoay (Linh hoạt 3 ca theo tuần)';
                suggestedSalary = '13000000';
                break;
            default:
                break;
        }

        const positions = getPositionsByDepartment(suggestedDept);
        setCreateFormData((prev) => ({
            ...prev,
            role: newRole,
            department: suggestedDept,
            position: positions[0] || 'Nhân viên',
            shift: suggestedShift,
            salary_base: suggestedSalary,
            employee_code: generateEmployeeCode(suggestedDept),
        }));
    };

    // Khi đổi phòng ban trong form thêm mới: cập nhật danh sách chức danh & mã NV
    const handleCreateDepartmentChange = (newDept) => {
        const positions = getPositionsByDepartment(newDept);
        setCreateFormData((prev) => ({
            ...prev,
            department: newDept,
            position: positions[0] || 'Nhân viên',
            employee_code: generateEmployeeCode(newDept),
        }));
    };

    // Submit tạo nhân viên
    const handleCreateEmployee = async (e) => {
        e.preventDefault();

        // Bảo mật: Quản lý không được phép tạo tài khoản có vai trò Quản lý, Chủ khách sạn hoặc Admin
        if (isManager && ['admin', 'owner', 'manager'].includes(createFormData.role)) {
            setAlertMessage({
                type: 'error',
                text: 'Quản lý (Manager) chỉ có quyền tạo tài khoản cho nhân viên cấp dưới (Lễ tân, Thu ngân, Buồng phòng...).',
            });
            return;
        }

        setIsSubmitting(true);

        const payload = {
            fullName: createFormData.fullName,
            email: createFormData.email,
            phone: createFormData.phone,
            password: createFormData.password,
            role: createFormData.role,
            employee_code: createFormData.employee_code,
            department: createFormData.department,
            position: createFormData.position,
            shift: createFormData.shift,
            base_salary: createFormData.salary_base,
            hire_date: createFormData.hire_date,
        };

        const res = await adminUserService.createEmployee(payload);
        setIsSubmitting(false);

        if (res.success) {
            setIsCreateModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Đã tạo mới nhân viên "${res.employee?.full_name || createFormData.fullName}" thành công! Mật khẩu khởi tạo: ${createFormData.password}`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể tạo nhân viên mới. Vui lòng kiểm tra lại.',
            });
        }
    };

    // =========================================================================
    // 2. CHỨC NĂNG CHỈNH SỬA THÔNG TIN NHÂN VIÊN
    // =========================================================================
    const handleOpenEdit = (emp) => {
        // Quản lý không được can thiệp vào tài khoản Admin hoặc Chủ khách sạn
        if (isManager && ['admin', 'owner', 'manager'].includes(emp.role)) {
            setAlertMessage({
                type: 'error',
                text: 'Quản lý không có quyền chỉnh sửa hồ sơ của Chủ khách sạn, Admin hoặc Quản lý khác.',
            });
            return;
        }

        setSelectedEmployee(emp);
        const dept = emp.employee_profile?.department || HOTEL_DEPARTMENTS[0].name;
        const currentPos = emp.employee_profile?.position || 'Nhân viên';
        const deptPositions = getPositionsByDepartment(dept);
        const isCustom = !deptPositions.includes(currentPos);

        setEditFormData({
            full_name: emp.full_name || '',
            email: emp.email || '',
            phone_number: emp.phone_number || '',
            address: emp.address || '',
            password: '',
            showPassword: false,
            employee_code: emp.employee_profile?.employee_code || '',
            department: dept,
            position: currentPos,
            shift: emp.employee_profile?.shift || HOTEL_SHIFTS[0],
            salary_base: emp.employee_profile?.base_salary || emp.employee_profile?.salary_base || '',
            hire_date: emp.employee_profile?.hire_date || '',
            is_active: emp.is_active,
            customPosition: isCustom,
        });
        setIsEditModalOpen(true);
    };

    // Khi đổi phòng ban trong form sửa: gợi ý lại chức danh
    const handleEditDepartmentChange = (newDept) => {
        const positions = getPositionsByDepartment(newDept);
        setEditFormData((prev) => ({
            ...prev,
            department: newDept,
            position: positions[0] || 'Nhân viên',
            customPosition: false,
        }));
    };

    // Submit lưu chỉnh sửa
    const handleSaveEdit = async (e) => {
        e.preventDefault();

        // Kiểm tra độ dài mật khẩu nếu có nhập
        if (editFormData.password && editFormData.password.trim().length < 6) {
            setAlertMessage({
                type: 'error',
                text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
            });
            return;
        }

        setIsSubmitting(true);

        const payload = {
            full_name: editFormData.full_name,
            email: editFormData.email,
            phone_number: editFormData.phone_number,
            address: editFormData.address,
            employee_code: editFormData.employee_code,
            department: editFormData.department,
            position: editFormData.position,
            shift: editFormData.shift,
            base_salary: editFormData.salary_base,
            hire_date: editFormData.hire_date || null,
            is_active: editFormData.is_active,
        };

        // Chỉ gửi password khi admin có nhập mật khẩu mới
        if (editFormData.password && editFormData.password.trim()) {
            payload.password = editFormData.password.trim();
        }

        const res = await adminUserService.updateEmployee(selectedEmployee.id, payload);
        setIsSubmitting(false);

        if (res.success) {
            setIsEditModalOpen(false);
            const passNote = editFormData.password ? ' (Đã cập nhật mật khẩu mới)' : '';
            setAlertMessage({
                type: 'success',
                text: `Cập nhật hồ sơ nhân viên ${res.employee?.full_name || editFormData.full_name} thành công!${passNote}`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Có lỗi xảy ra khi lưu thông tin.',
            });
        }
    };

    // =========================================================================
    // 3. CHỨC NĂNG PHÂN QUYỀN VAI TRÒ (RBAC ROLE ASSIGNMENT)
    // =========================================================================
    const handleOpenAssignRole = (emp) => {
        // Quản lý không được phép phân quyền cho Chủ khách sạn, Admin hoặc Quản lý khác
        if (isManager && ['admin', 'owner', 'manager'].includes(emp.role)) {
            setAlertMessage({
                type: 'error',
                text: 'Quản lý không có quyền phân quyền hoặc thay đổi vai trò của Chủ khách sạn, Admin hoặc Quản lý khác.',
            });
            return;
        }

        setSelectedEmployee(emp);
        const currentDept = emp.employee_profile?.department || 'Lễ Tân & Tiền Sảnh';
        const currentPos = emp.employee_profile?.position || 'Nhân viên';
        const currentShift = emp.employee_profile?.shift || 'Ca Sáng (06:00 - 14:00)';

        setAssignRoleData({
            role: emp.role,
            department: currentDept,
            position: currentPos,
            shift: currentShift,
            autoSync: true,
        });
        setIsAssignRoleModalOpen(true);
    };

    // Khi chọn vai trò mới trong modal phân quyền
    const handleAssignRoleChange = (newRole) => {
        let suggestedDept = assignRoleData.department;
        let suggestedPos = assignRoleData.position;

        if (assignRoleData.autoSync) {
            switch (newRole) {
                case 'admin':
                    suggestedDept = 'Ban Quản Lý & Điều Hành';
                    suggestedPos = 'Quản Trị Viên Hệ Thống (System Admin)';
                    break;
                case 'owner':
                    suggestedDept = 'Ban Quản Lý & Điều Hành';
                    suggestedPos = 'Chủ Sở Hữu / Hội Đồng Quản Trị';
                    break;
                case 'manager':
                    suggestedDept = 'Ban Quản Lý & Điều Hành';
                    suggestedPos = 'Tổng Giám Đốc (General Manager)';
                    break;
                case 'receptionist':
                    suggestedDept = 'Lễ Tân & Tiền Sảnh';
                    suggestedPos = 'Nhân Viên Lễ Tân (Receptionist)';
                    break;
                case 'cashier':
                    suggestedDept = 'Kế Toán & Thu Ngân';
                    suggestedPos = 'Nhân Viên Thu Ngân Khách Sạn (Cashier)';
                    break;
                case 'housekeeper':
                    suggestedDept = 'Buồng Phòng & Vệ Sinh';
                    suggestedPos = 'Nhân Viên Dọn Phòng (Housekeeper)';
                    break;
                case 'service_staff':
                    suggestedDept = 'Ẩm Thực & Nhà Hàng (F&B)';
                    suggestedPos = 'Nhân Viên Phục Vụ Bàn (Waitstaff)';
                    break;
                case 'technician':
                    suggestedDept = 'Kỹ Thuật & Bảo Trì Cơ Điện';
                    suggestedPos = 'Kỹ Thuật Viên Điện Lạnh & Điều Hòa';
                    break;
                default:
                    break;
            }
        }

        setAssignRoleData((prev) => ({
            ...prev,
            role: newRole,
            department: suggestedDept,
            position: suggestedPos,
        }));
    };

    // Submit lưu phân quyền
    const handleSaveRole = async (e) => {
        e.preventDefault();
        if (!selectedEmployee || !assignRoleData.role) return;

        // Quản lý không được phép gán vai trò Admin, Owner, Manager
        if (isManager && ['admin', 'owner', 'manager'].includes(assignRoleData.role)) {
            setAlertMessage({
                type: 'error',
                text: 'Quản lý chỉ có quyền phân quyền cho nhân viên các vai trò cấp dưới.',
            });
            return;
        }

        setIsSubmitting(true);

        const payload = {
            role: assignRoleData.role,
            department: assignRoleData.department,
            position: assignRoleData.position,
            shift: assignRoleData.shift,
        };

        const res = await adminUserService.updateEmployee(selectedEmployee.id, payload);
        setIsSubmitting(false);

        if (res.success) {
            setIsAssignRoleModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Đã phân quyền thành công vai trò "${res.employee?.role_display || assignRoleData.role}" cho nhân viên ${selectedEmployee.full_name || selectedEmployee.username}!`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể cập nhật phân quyền. Vui lòng thử lại.',
            });
        }
    };

    // =========================================================================
    // 4. CHỨC NĂNG XÓA NHÂN VIÊN VỚI MODAL XÁC NHẬN AN TOÀN
    // =========================================================================
    const handleOpenDelete = (emp) => {
        if (isManager && ['admin', 'owner', 'manager'].includes(emp.role)) {
            setAlertMessage({
                type: 'error',
                text: 'Quản lý không có quyền xóa tài khoản của Chủ khách sạn, Admin hoặc Quản lý khác.',
            });
            return;
        }
        setSelectedEmployee(emp);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedEmployee) return;
        setIsSubmitting(true);

        const res = await adminUserService.deleteEmployee(selectedEmployee.id);
        setIsSubmitting(false);

        if (res.success) {
            setIsDeleteModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Đã xóa vĩnh viễn tài khoản nhân viên "${selectedEmployee.full_name || selectedEmployee.username}" khỏi hệ thống!`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể xóa tài khoản này.',
            });
        }
    };

    // =========================================================================
    // 5. CHỨC NĂNG XEM CHI TIẾT HỒ SƠ NHÂN SỰ
    // =========================================================================
    const handleOpenDetail = (emp) => {
        setSelectedEmployee(emp);
        setIsDetailModalOpen(true);
    };

    // =========================================================================
    // 6. KHÓA / MỞ KHÓA TÀI KHOẢN NHANH
    // =========================================================================
    const handleToggleStatus = async (emp) => {
        if (isManager && ['admin', 'owner', 'manager'].includes(emp.role)) {
            setAlertMessage({
                type: 'error',
                text: 'Quản lý không có quyền khóa tài khoản của Chủ khách sạn, Admin hoặc Quản lý khác.',
            });
            return;
        }

        const actionText = emp.is_active ? 'tạm khóa' : 'kích hoạt lại';
        const res = await adminUserService.toggleEmployeeStatus(emp.id, !emp.is_active);
        if (res.success) {
            setAlertMessage({
                type: 'success',
                text: `Đã ${actionText} tài khoản của nhân viên "${emp.full_name || emp.username}" thành công!`,
            });
            fetchEmployees();
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Thao tác không thành công.',
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
        const roleObj = roles.find((r) => r.code === roleCode || r.role === roleCode);
        const name = roleObj ? (roleObj.name || roleObj.title || roleCode) : roleCode;
        const color = roleObj ? (roleObj.color || roleObj.badge_color || 'slate') : 'slate';

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

    // Thống kê nhanh
    const activeCount = employees.filter((e) => e.is_active).length;
    const managementCount = employees.filter((e) => ['admin', 'owner', 'manager'].includes(e.role)).length;
    const operationsCount = employees.filter((e) => !['admin', 'owner', 'manager'].includes(e.role)).length;

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                        Quản Lý Nhân Sự & Phân Quyền Vai Trò
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Quản lý đầy đủ chức năng thêm, sửa, xóa, phân quyền chi tiết, chọn phòng ban, chức danh và ca làm việc tại Khách Sạn TA Đà Nẵng.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsRoleMatrixOpen(true)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                        <span>🛡️</span>
                        <span>Ma Trận Phân Quyền</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
                    >
                        <span>＋</span>
                        <span>Thêm Nhân Viên Mới</span>
                    </button>
                </div>
            </div>

            {/* Alert Message Toast */}
            {alertMessage && (
                <div
                    className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border transition animate-fadeIn ${
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
                        className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 4 Thẻ Thống Kê Nhanh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            TỔNG NHÂN SỰ
                        </span>
                        <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
                        <span className="text-[11px] text-slate-500">Toàn bộ nhân sự các khối</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                        👥
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            ĐANG HOẠT ĐỘNG
                        </span>
                        <div className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</div>
                        <span className="text-[11px] text-emerald-700 font-medium">Tài khoản làm việc</span>
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

            {/* Bộ Lọc & Tìm Kiếm Đa Tiêu Chí */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <form onSubmit={handleSearchSubmit} className="space-y-3">
                    <div className="flex flex-col lg:flex-row items-center gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 w-full">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                🔍
                            </span>
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo Tên, Mã NV, Email, SĐT, Chức danh..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                            />
                        </div>

                        {/* Lọc theo Vai trò */}
                        <div className="w-full lg:w-48">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-600 transition"
                            >
                                <option value="all">Tất cả vai trò ({roles.length})</option>
                                {roles.map((r) => {
                                    const roleCode = r.code || r.role;
                                    const roleName = r.name || r.title || roleCode;
                                    return (
                                        <option key={roleCode} value={roleCode}>
                                            {roleName}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Lọc theo Phòng ban */}
                        <div className="w-full lg:w-56">
                            <select
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-600 transition"
                            >
                                <option value="all">Tất cả phòng ban ({HOTEL_DEPARTMENTS.length})</option>
                                {HOTEL_DEPARTMENTS.map((dept) => (
                                    <option key={dept.name} value={dept.name}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc theo Ca làm việc */}
                        <div className="w-full lg:w-48">
                            <select
                                value={shiftFilter}
                                onChange={(e) => setShiftFilter(e.target.value)}
                                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-600 transition"
                            >
                                <option value="all">Mọi ca làm việc</option>
                                {HOTEL_SHIFTS.map((s) => (
                                    <option key={s} value={s}>
                                        {s.split('(')[0].trim()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc theo Trạng thái */}
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
                            className="w-full lg:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0 cursor-pointer"
                        >
                            Lọc dữ liệu
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setRoleFilter('all');
                                setDepartmentFilter('all');
                                setShiftFilter('all');
                                setStatusFilter('all');
                                setCurrentPage(1);
                            }}
                            className="w-full lg:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition shrink-0 cursor-pointer"
                            title="Đặt lại bộ lọc"
                        >
                            🔄
                        </button>
                    </div>
                </form>
            </div>

            {/* Bảng Danh Sách Nhân Viên */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900">
                            Danh Sách Nhân Viên Khách Sạn
                        </h3>
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                            {totalCount} Nhân sự
                        </span>
                    </div>
                    <span className="text-xs text-slate-400">
                        Đồng bộ hồ sơ nhân sự & phân quyền thời gian thực
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="py-3.5 px-4">NHÂN VIÊN</th>
                                <th className="py-3.5 px-4">MÃ NV</th>
                                <th className="py-3.5 px-4">VAI TRÒ (RBAC)</th>
                                <th className="py-3.5 px-4">PHÒNG BAN & CHỨC DANH</th>
                                <th className="py-3.5 px-4">CA LÀM VIỆC & LƯƠNG</th>
                                <th className="py-3.5 px-4 min-w-[110px] whitespace-nowrap">TRẠNG THÁI</th>
                                <th className="py-3.5 px-4 text-right">THAO TÁC</th>
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
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetail(emp)}
                                                        className="font-bold text-slate-900 hover:text-blue-600 transition text-left cursor-pointer"
                                                    >
                                                        {emp.full_name || emp.username}
                                                    </button>
                                                    <div className="text-[11px] text-slate-400">
                                                        {emp.email} • {emp.phone_number || 'Chưa có SĐT'}
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
                                            <div className="text-[10px] text-slate-500 font-medium">
                                                {emp.employee_profile?.department || 'Chưa xếp phòng ban'}
                                            </div>
                                        </td>

                                        {/* Shift & Salary */}
                                        <td className="py-3.5 px-4">
                                            <div className="text-slate-800 font-medium">
                                                {emp.employee_profile?.shift || 'Chưa xếp ca'}
                                            </div>
                                            <div className="text-[11px] font-bold text-emerald-600">
                                                {formatCurrency(emp.employee_profile?.base_salary || emp.employee_profile?.salary_base)}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            {emp.is_active ? (
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
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDetail(emp)}
                                                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition cursor-pointer"
                                                    title="Xem chi tiết hồ sơ"
                                                >
                                                    👁️ Xem
                                                </button>
                                                {isManager && ['admin', 'owner', 'manager'].includes(emp.role) ? (
                                                    <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                                                        <span>🔒</span>
                                                        <span>Cấp trên (Chỉ xem)</span>
                                                    </span>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenAssignRole(emp)}
                                                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition flex items-center gap-1 border border-indigo-200 cursor-pointer"
                                                            title="Phân quyền vai trò chi tiết"
                                                        >
                                                            <span>🛡️</span>
                                                            <span>Phân quyền</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(emp)}
                                                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition cursor-pointer"
                                                            title="Chỉnh sửa hồ sơ"
                                                        >
                                                            ✏️ Sửa
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatus(emp)}
                                                            className={`px-2 py-1 rounded-lg font-medium text-[11px] transition cursor-pointer ${
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
                                                            onClick={() => handleOpenDelete(emp)}
                                                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium text-[11px] transition cursor-pointer"
                                                            title="Xóa tài khoản nhân viên"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Phân trang (Pagination) */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={10}
                    onPageChange={handlePageChange}
                />
            </div>

            {/* ========================================================================= */}
            {/* MODAL 1: THÊM MỚI NHÂN VIÊN & TÀI KHOẢN NỘI BỘ */}
            {/* ========================================================================= */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
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
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleCreateEmployee} className="p-6 space-y-5 text-xs text-slate-800 overflow-y-auto flex-1">
                            {/* Khối 1: Thông tin tài khoản đăng nhập */}
                            <div>
                                <h4 className="font-bold text-xs uppercase tracking-wider text-blue-700 mb-3 flex items-center gap-1.5">
                                    <span>👤</span>
                                    <span>1. Thông tin cá nhân & Tài khoản</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Họ và tên nhân viên *</label>
                                        <input
                                            type="text"
                                            placeholder="Ví dụ: Lê Hoàng Minh"
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
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono font-bold text-blue-600"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Email đăng nhập *</label>
                                        <input
                                            type="email"
                                            placeholder="minh.le@tadanang.vn"
                                            value={createFormData.email}
                                            onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Số điện thoại liên hệ *</label>
                                        <input
                                            type="tel"
                                            placeholder="0905123456"
                                            value={createFormData.phone}
                                            onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                            required
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block font-bold text-slate-700 mb-1">Mật khẩu khởi tạo *</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={createFormData.password}
                                                onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setCreateFormData({ ...createFormData, password: `Pass${Math.floor(100000 + Math.random() * 900000)}` })}
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
                                    <span>🛡️</span>
                                    <span>2. Phân quyền & Vị trí công tác</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* 1. Vai trò (Role) */}
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">
                                            Vai trò phân quyền (RBAC) *
                                        </label>
                                        <select
                                            value={createFormData.role}
                                            onChange={(e) => handleCreateRoleChange(e.target.value)}
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
                                            value={createFormData.department}
                                            onChange={(e) => handleCreateDepartmentChange(e.target.value)}
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
                                                onClick={() => setCreateFormData({ ...createFormData, customPosition: !createFormData.customPosition })}
                                                className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                                            >
                                                {createFormData.customPosition ? '← Chọn từ danh sách gợi ý' : '＋ Nhập chức danh khác'}
                                            </button>
                                        </div>
                                        {createFormData.customPosition ? (
                                            <input
                                                type="text"
                                                placeholder="Nhập tên chức danh tùy chỉnh..."
                                                value={createFormData.position}
                                                onChange={(e) => setCreateFormData({ ...createFormData, position: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                                required
                                            />
                                        ) : (
                                            <select
                                                value={createFormData.position}
                                                onChange={(e) => setCreateFormData({ ...createFormData, position: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                            >
                                                {getPositionsByDepartment(createFormData.department).map((pos) => (
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
                                            value={createFormData.shift}
                                            onChange={(e) => setCreateFormData({ ...createFormData, shift: e.target.value })}
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
                                            value={createFormData.salary_base}
                                            onChange={(e) => setCreateFormData({ ...createFormData, salary_base: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                            required
                                        />
                                        <span className="text-[11px] text-slate-400 mt-1 block">
                                            Tương đương: {formatCurrency(createFormData.salary_base)}
                                        </span>
                                    </div>

                                    {/* 6. Ngày vào làm */}
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">
                                            Ngày bắt đầu vào làm *
                                        </label>
                                        <input
                                            type="date"
                                            value={createFormData.hire_date}
                                            onChange={(e) => setCreateFormData({ ...createFormData, hire_date: e.target.value })}
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
                                    onClick={() => setIsCreateModalOpen(false)}
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
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: CHỈNH SỬA THÔNG TIN NHÂN VIÊN */}
            {/* ========================================================================= */}
            {isEditModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shadow-xs">
                                    ✏️
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                        Chỉnh Sửa Hồ Sơ Nhân Viên
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedEmployee.full_name || selectedEmployee.username} (Mã: {selectedEmployee.employee_profile?.employee_code || selectedEmployee.id})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
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
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-mono font-bold text-blue-600"
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

                                {/* Phòng ban */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Phòng ban trực thuộc</label>
                                    <select
                                        value={editFormData.department}
                                        onChange={(e) => handleEditDepartmentChange(e.target.value)}
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
                                            onClick={() => setEditFormData({ ...editFormData, customPosition: !editFormData.customPosition })}
                                            className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                                        >
                                            {editFormData.customPosition ? '← Chọn gợi ý' : '＋ Nhập khác'}
                                        </button>
                                    </div>
                                    {editFormData.customPosition ? (
                                        <input
                                            type="text"
                                            value={editFormData.position}
                                            onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        />
                                    ) : (
                                        <select
                                            value={editFormData.position}
                                            onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        >
                                            {getPositionsByDepartment(editFormData.department).map((pos) => (
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
                                        value={editFormData.shift}
                                        onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })}
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
                                        value={editFormData.salary_base}
                                        onChange={(e) => setEditFormData({ ...editFormData, salary_base: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                    <span className="text-[11px] text-slate-400 mt-1 block">
                                        Định dạng: {formatCurrency(editFormData.salary_base)}
                                    </span>
                                </div>

                                {/* Ngày vào làm */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ngày vào làm</label>
                                    <input
                                        type="date"
                                        value={editFormData.hire_date || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, hire_date: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                    />
                                </div>

                                {/* Trạng thái */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Trạng thái tài khoản</label>
                                    <select
                                        value={editFormData.is_active ? 'active' : 'inactive'}
                                        onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'active' })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition font-semibold"
                                    >
                                        <option value="active">🟢 Đang hoạt động bình thường</option>
                                        <option value="inactive">🔴 Đang tạm khóa / Nghỉ việc</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block font-bold text-slate-700 mb-1">Địa chỉ thường trú</label>
                                    <input
                                        type="text"
                                        value={editFormData.address}
                                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                        placeholder="Ví dụ: 128 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng"
                                    />
                                </div>

                                {/* Đặt lại mật khẩu mới cho nhân viên */}
                                <div className="sm:col-span-2 p-4 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">🔑</span>
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
                                                setEditFormData({ ...editFormData, password: randomPass, showPassword: true });
                                            }}
                                            className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                                        >
                                            <span>🎲</span>
                                            <span>Tạo ngẫu nhiên</span>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={editFormData.showPassword ? 'text' : 'password'}
                                            value={editFormData.password}
                                            onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                            placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự) hoặc để trống nếu giữ nguyên..."
                                            className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-mono text-xs"
                                            minLength={6}
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {editFormData.password && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditFormData({ ...editFormData, password: '' })}
                                                    className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                                    title="Xóa mật khẩu đã nhập"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setEditFormData({ ...editFormData, showPassword: !editFormData.showPassword })}
                                                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                                            >
                                                {editFormData.showPassword ? 'Ẩn' : 'Hiện'}
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
                                    onClick={() => setIsEditModalOpen(false)}
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
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: PHÂN QUYỀN VAI TRÒ CHI TIẾT & ĐỒNG BỘ PHÒNG BAN, CHỨC DANH */}
            {/* ========================================================================= */}
            {isAssignRoleModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xl shadow-xs">
                                    🛡️
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                        Phân Quyền Vai Trò & Vị Trí Cho Nhân Viên
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedEmployee.full_name || selectedEmployee.username} (Mã: {selectedEmployee.employee_profile?.employee_code || selectedEmployee.id})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAssignRoleModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveRole} className="p-6 space-y-5 text-xs text-slate-800 overflow-y-auto flex-1">
                            {/* Danh sách 8 vai trò RBAC */}
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
                                    <span>⚠️</span>
                                    <div>
                                        <strong>Cấp bậc Quản lý cao cấp:</strong> Vai trò này sẽ cấp quyền truy cập vào cổng quản trị <strong>AdminDashboard</strong> và toàn quyền xem số liệu doanh thu, phân bổ phòng và nhân sự của khách sạn.
                                    </div>
                                </div>
                            )}

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setIsRoleMatrixOpen(true)}
                                    className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <span>🛡️</span>
                                    <span>Xem chi tiết ma trận toàn quyền</span>
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAssignRoleModalOpen(false)}
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
            )}

            {/* ========================================================================= */}
            {/* MODAL 4: XÁC NHẬN XÓA NHÂN VIÊN CHUYÊN NGHIỆP */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto shadow-inner border border-rose-200">
                                🗑️
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
                                    avatar={selectedEmployee.avatar}
                                    name={selectedEmployee.full_name || selectedEmployee.username}
                                    role={selectedEmployee.role}
                                    size="md"
                                    border={false}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-900 text-xs truncate">
                                        {selectedEmployee.full_name || selectedEmployee.username}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        Mã: {selectedEmployee.employee_profile?.employee_code || selectedEmployee.id} • {selectedEmployee.employee_profile?.department}
                                    </div>
                                    <div className="mt-1">
                                        {getRoleBadge(selectedEmployee.role)}
                                    </div>
                                </div>
                            </div>

                            <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] text-left flex items-start gap-2">
                                <span>⚠️</span>
                                <div>
                                    Lưu ý: Không thể phục hồi tài khoản sau khi xóa. Nếu chỉ muốn ngưng làm việc tạm thời, bạn nên chọn chức năng <strong>"Khóa tài khoản"</strong>.
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                                >
                                    Hủy Bỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? 'Đang xóa...' : 'Xóa Vĩnh Viễn'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 5: XEM CHI TIẾT HỒ SƠ NHÂN SỰ TOÀN DIỆN */}
            {/* ========================================================================= */}
            {isDetailModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shadow-xs">
                                    👤
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                        Hồ Sơ Chi Tiết Cán Bộ Nhân Viên
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Khách Sạn TA Đà Nẵng • Mã: {selectedEmployee.employee_profile?.employee_code || selectedEmployee.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDetailModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-5 text-xs text-slate-800 overflow-y-auto flex-1">
                            {/* Profile Card Header */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <UserAvatar
                                    avatar={selectedEmployee.avatar}
                                    name={selectedEmployee.full_name || selectedEmployee.username}
                                    role={selectedEmployee.role}
                                    size="xl"
                                    border={true}
                                />
                                <div className="text-center sm:text-left flex-1 min-w-0">
                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                        <h3 className="text-lg font-bold text-slate-900 truncate">
                                            {selectedEmployee.full_name || selectedEmployee.username}
                                        </h3>
                                        {selectedEmployee.is_active ? (
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
                                        Mã nhân viên: <strong>{selectedEmployee.employee_profile?.employee_code || selectedEmployee.id}</strong> • Username: @{selectedEmployee.username}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        {getRoleBadge(selectedEmployee.role)}
                                        <span className="bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                                            {selectedEmployee.employee_profile?.department || 'Chung'}
                                        </span>
                                        <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                                            {selectedEmployee.employee_profile?.position || 'Nhân viên'}
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
                                            {selectedEmployee.employee_profile?.department || 'Chưa cập nhật'}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Chức danh</span>
                                        <strong className="text-slate-900 text-xs block mt-0.5">
                                            {selectedEmployee.employee_profile?.position || 'Nhân viên'}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Ca làm việc</span>
                                        <strong className="text-slate-900 text-xs block mt-0.5">
                                            {selectedEmployee.employee_profile?.shift || 'Chưa xếp ca'}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Lương cơ bản</span>
                                        <strong className="text-emerald-600 text-xs block mt-0.5">
                                            {formatCurrency(selectedEmployee.employee_profile?.base_salary || selectedEmployee.employee_profile?.salary_base)}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Ngày vào làm</span>
                                        <strong className="text-slate-900 text-xs block mt-0.5 font-mono">
                                            {selectedEmployee.employee_profile?.hire_date || 'Chưa cập nhật'}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Quyền hạn Staff</span>
                                        <strong className="text-slate-900 text-xs block mt-0.5">
                                            {selectedEmployee.is_staff ? 'Có quyền Staff' : 'Nhân sự vận hành'}
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
                                            {selectedEmployee.email || 'Chưa có email'}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Số điện thoại</span>
                                        <strong className="text-slate-900 text-xs block mt-0.5">
                                            {selectedEmployee.phone_number || 'Chưa cập nhật'}
                                        </strong>
                                    </div>
                                    <div className="sm:col-span-2 p-3 bg-white rounded-xl border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Địa chỉ thường trú</span>
                                        <p className="text-slate-700 text-xs mt-0.5">
                                            {selectedEmployee.address || 'Chưa cập nhật địa chỉ'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {!(isManager && ['admin', 'owner', 'manager'].includes(selectedEmployee.role)) && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsDetailModalOpen(false);
                                                    handleOpenAssignRole(selectedEmployee);
                                                }}
                                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition cursor-pointer"
                                            >
                                                🛡️ Phân quyền vai trò
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsDetailModalOpen(false);
                                                    handleOpenEdit(selectedEmployee);
                                                }}
                                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                                            >
                                                ✏️ Sửa hồ sơ
                                            </button>
                                        </>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
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
