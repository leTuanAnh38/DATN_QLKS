export const HOTEL_DEPARTMENTS = [
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

export const HOTEL_SHIFTS = [
    'Ca Sáng (06:00 - 14:00)',
    'Ca Chiều (14:00 - 22:00)',
    'Ca Đêm (22:00 - 06:00 hôm sau)',
    'Ca Hành Chính (08:00 - 17:00)',
    'Ca Gãy / Linh Hoạt (10:00 - 14:00 & 18:00 - 22:00)',
    'Ca Xoay (Linh hoạt 3 ca theo tuần)',
];

export const getPositionsByDepartment = (deptName) => {
    const found = HOTEL_DEPARTMENTS.find((d) => d.name === deptName);
    return found ? found.positions : ['Nhân viên'];
};

export const generateEmployeeCode = (deptName) => {
    const found = HOTEL_DEPARTMENTS.find((d) => d.name === deptName);
    const prefix = found ? found.codePrefix : 'NV';
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${prefix}${randomNum}`;
};

