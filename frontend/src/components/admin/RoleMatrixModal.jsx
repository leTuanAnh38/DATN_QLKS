import React from 'react';

export default function RoleMatrixModal({ isOpen, onClose, roles = [] }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl">
                            🛡️
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white">
                                Bảng Ma Trận Phân Quyền Chi Tiết Theo Vai Trò
                            </h3>
                            <p className="text-xs text-slate-300">
                                Quy chuẩn phân cấp trách nhiệm & phạm vi truy cập hệ thống Khách Sạn TA Đà Nẵng
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body: Bảng phân quyền cuộn được */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
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
                                {roles.map((r) => {
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
                                                        <strong className="block text-slate-900">{r.title}</strong>
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
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                        Đóng cửa sổ
                    </button>
                </div>
            </div>
        </div>
    );
}
