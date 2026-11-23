import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Compass, Home, ArrowLeft, BedDouble } from 'lucide-react';

export default function NotFound() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isAdminRoute = pathname.startsWith('/admin');

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/90 shadow-xl p-6 sm:p-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
                    <Compass className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-mono text-xs font-bold tracking-wider">
                        LỖI 404 • KHÔNG TÌM THẤY TRANG
                    </span>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Đường dẫn bạn tìm không tồn tại
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                        Trang <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs">{pathname}</code> có thể đã được di chuyển hoặc không còn khả dụng.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Quay lại</span>
                    </button>

                    {isAdminRoute ? (
                        <Link
                            to="/admin"
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2"
                        >
                            <Home className="w-4 h-4" />
                            <span>Về Bảng điều khiển Quản trị</span>
                        </Link>
                    ) : (
                        <>
                            <Link
                                to="/"
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2"
                            >
                                <Home className="w-4 h-4" />
                                <span>Về Trang chủ</span>
                            </Link>
                            <Link
                                to="/rooms"
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2"
                            >
                                <BedDouble className="w-4 h-4" />
                                <span>Xem Phòng nghỉ</span>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
