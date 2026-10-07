import React from 'react';

// Danh mục ma trận phân quyền chuẩn 5 sao (Fallback dự phòng đảm bảo luôn luôn có dữ liệu tức thì)
export const DEFAULT_ROLE_MATRIX = [
    {
        role: 'admin',
        title: 'Admin Hệ Thống',
        level: 'Toàn quyền',
        badge_color: 'purple',
        icon: '👑',
        description: 'Quản trị tối cao toàn bộ hệ thống, phân quyền người dùng, cấu hình khách sạn và cơ sở dữ liệu.',
        scope: 'Cấp quyền, tạo nhân sự, quản lý dữ liệu, kiểm toán hệ thống',
        permissions: {
            rooms: 'Toàn quyền cấu hình',
            bookings: 'Toàn quyền duyệt/hủy',
            guests: 'Toàn quyền xem/sửa',
            employees: 'Toàn quyền phân quyền',
            finance: 'Toàn quyền doanh thu',
            settings: 'Cấu hình hệ thống',
        }
    },
    {
        role: 'owner',
        title: 'Chủ Khách Sạn (Owner)',
        level: 'Cấp cao',
        badge_color: 'amber',
        icon: '💼',
        description: 'Giám sát hoạt động kinh doanh, xem báo cáo doanh thu tài chính, công suất phòng và chiến lược giá.',
        scope: 'Báo cáo doanh thu, chiến lược phòng, giám sát nhân sự',
        permissions: {
            rooms: 'Xem & Đổi giá',
            bookings: 'Xem chi tiết',
            guests: 'Xem danh sách VIP',
            employees: 'Xem báo cáo nhân sự',
            finance: 'Toàn quyền tài chính',
            settings: 'Xem cấu hình',
        }
    },
    {
        role: 'manager',
        title: 'Quản Lý Khách Sạn (Manager)',
        level: 'Điều hành',
        badge_color: 'blue',
        icon: '👔',
        description: 'Điều hành vận hành thường nhật: duyệt đặt phòng, phân công ca làm nhân viên, quản lý chất lượng dịch vụ.',
        scope: 'Điều phối nhân sự, duyệt phòng, giải quyết sự vụ',
        permissions: {
            rooms: 'Toàn quyền điều phối',
            bookings: 'Toàn quyền duyệt/đổi',
            guests: 'Toàn quyền quản lý',
            employees: 'Phân ca & Chấm công',
            finance: 'Xem & Xuất hóa đơn',
            settings: 'Cấu hình dịch vụ',
        }
    },
    {
        role: 'receptionist',
        title: 'Lễ Tân (Front Desk)',
        level: 'Tiếp đón',
        badge_color: 'emerald',
        icon: '🛎️',
        description: 'Check-in, check-out, gán phòng, tiếp nhận đặt phòng trực tiếp tại quầy, hỗ trợ yêu cầu khách lưu trú.',
        scope: 'Thủ tục phòng, tra cứu khách, gán chìa khóa phòng',
        permissions: {
            rooms: 'Xem & Gán phòng',
            bookings: 'Tạo & Check-in/out',
            guests: 'Xem & Cập nhật nhanh',
            employees: 'Chỉ xem ca trực',
            finance: 'Thu cọc & Tiền phòng',
            settings: 'Không có quyền',
        }
    },
    {
        role: 'cashier',
        title: 'Thu Ngân (Cashier)',
        level: 'Tài chính',
        badge_color: 'cyan',
        icon: '💳',
        description: 'Xác nhận thanh toán, quản lý hóa đơn VAT, thu tiền cọc và đối soát giao dịch thanh toán trực tuyến.',
        scope: 'Thu chi, xuất hóa đơn VAT, kết ca thu ngân',
        permissions: {
            rooms: 'Xem bảng giá phòng',
            bookings: 'Xem trạng thái tiền',
            guests: 'Xem hóa đơn khách',
            employees: 'Không có quyền',
            finance: 'Toàn quyền thu chi',
            settings: 'Không có quyền',
        }
    },
    {
        role: 'housekeeper',
        title: 'Nhân Viên Buồng Phòng',
        level: 'Vận hành buồng',
        badge_color: 'orange',
        icon: '🧹',
        description: 'Cập nhật trạng thái vệ sinh phòng (Đang dọn, Đã khử khuẩn, Sẵn sàng đón khách), kiểm kê mini bar.',
        scope: 'Trạng thái dọn phòng, báo vật tư, báo đồ thất lạc',
        permissions: {
            rooms: 'Cập nhật dọn phòng',
            bookings: 'Xem giờ trả phòng',
            guests: 'Không có quyền',
            employees: 'Xem ca làm việc',
            finance: 'Không có quyền',
            settings: 'Không có quyền',
        }
    },
    {
        role: 'service_staff',
        title: 'Nhân Viên Phục Vụ (F&B / Spa)',
        level: 'Dịch vụ',
        badge_color: 'rose',
        icon: '🍽️',
        description: 'Tiếp nhận order ẩm thực tận phòng, phục vụ nhà hàng, dịch vụ spa thư giãn và đưa đón hành lý.',
        scope: 'Order dịch vụ, giao đồ ăn phòng, phục vụ khách',
        permissions: {
            rooms: 'Xem số phòng order',
            bookings: 'Không có quyền',
            guests: 'Xem sở thích ăn uống',
            employees: 'Xem ca làm việc',
            finance: 'Ghi chi phí dịch vụ',
            settings: 'Không có quyền',
        }
    },
    {
        role: 'technician',
        title: 'Kỹ Thuật Viên (Technician)',
        level: 'Bảo trì',
        badge_color: 'indigo',
        icon: '🔧',
        description: 'Bảo dưỡng và sửa chữa hệ thống cơ điện, điều hòa nhiệt độ, internet wifi, thang máy và thiết bị trong phòng.',
        scope: 'Bảo trì trang thiết bị, sửa chữa kỹ thuật',
        permissions: {
            rooms: 'Báo trạng thái hỏng',
            bookings: 'Không có quyền',
            guests: 'Không có quyền',
            employees: 'Xem ca làm việc',
            finance: 'Không có quyền',
            settings: 'Không có quyền',
        }
    }
];

export default function RoleMatrixModal({ isOpen, onClose, roles = [] }) {
    if (!isOpen) return null;

    // Ưu tiên nạp danh sách roles từ backend, nếu chưa có thì dùng bộ DEFAULT_ROLE_MATRIX chuẩn
    const displayRoles = roles && roles.length > 0 ? roles : DEFAULT_ROLE_MATRIX;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header: Tone nền trắng trang nhã, hiện đại */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xl shadow-xs">
                            🛡️
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                Bảng Ma Trận Phân Quyền Chi Tiết Theo Vai Trò
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Quy chuẩn phân cấp trách nhiệm & phạm vi truy cập hệ thống Khách Sạn TA Đà Nẵng
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                        title="Đóng cửa sổ"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body: Bảng phân quyền cuộn được */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <th className="p-3.5">Vai trò & Cấp bậc</th>
                                    <th className="p-3.5">Mô tả chức trách</th>
                                    <th className="p-3.5">Quản lý Phòng</th>
                                    <th className="p-3.5">Đặt phòng</th>
                                    <th className="p-3.5">Khách hàng</th>
                                    <th className="p-3.5">Nhân sự</th>
                                    <th className="p-3.5">Doanh thu & Hóa đơn</th>
                                    <th className="p-3.5">Cài đặt hệ thống</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {displayRoles.map((r) => {
                                    const badgeStyles = {
                                        purple: 'bg-purple-50 text-purple-700 border-purple-200',
                                        amber: 'bg-amber-50 text-amber-700 border-amber-200',
                                        blue: 'bg-blue-50 text-blue-700 border-blue-200',
                                        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                        cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                                        orange: 'bg-orange-50 text-orange-700 border-orange-200',
                                        rose: 'bg-rose-50 text-rose-700 border-rose-200',
                                        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                    }[r.badge_color] || 'bg-slate-100 text-slate-700 border-slate-200';

                                    return (
                                        <tr key={r.role} className="hover:bg-slate-50/80 transition">
                                            <td className="p-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">{r.icon}</span>
                                                    <div>
                                                        <strong className="block text-slate-900 font-bold">{r.title}</strong>
                                                        <span className={`inline-block mt-0.5 px-2 py-0.5 text-[9px] font-bold rounded-full border ${badgeStyles}`}>
                                                            {r.level}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3.5 min-w-[200px] text-slate-600 leading-relaxed">
                                                {r.description}
                                            </td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">{r.permissions?.rooms}</span>
                                            </td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">{r.permissions?.bookings}</span>
                                            </td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">{r.permissions?.guests}</span>
                                            </td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">{r.permissions?.employees}</span>
                                            </td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">{r.permissions?.finance}</span>
                                            </td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                <span className={`font-semibold ${r.permissions?.settings === 'Không có quyền' ? 'text-slate-400' : 'text-blue-600'}`}>
                                                    {r.permissions?.settings}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 flex items-start gap-3">
                        <span className="text-lg">💡</span>
                        <div className="text-xs">
                            <strong className="block mb-0.5 font-bold">Lưu ý về kiểm soát truy cập và bảo mật:</strong>
                            Chỉ những tài khoản thuộc nhóm vai trò <strong>Admin Hệ Thống</strong>, <strong>Chủ Khách Sạn</strong> và <strong>Quản Lý Khách Sạn</strong> mới có quyền truy cập vào cổng quản trị AdminDashboard. Các vai trò vận hành khác (Lễ tân, Thu ngân, Buồng phòng, Phục vụ, Kỹ thuật) đăng nhập vào các phân hệ POS / Lễ tân / Buồng phòng tương ứng.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                    >
                        Đóng cửa sổ
                    </button>
                </div>
            </div>
        </div>
    );
}
