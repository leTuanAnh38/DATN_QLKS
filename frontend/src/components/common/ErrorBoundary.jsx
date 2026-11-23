import React from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

/**
 * ErrorBoundary toàn cục:
 * - Bắt lỗi runtime React và lỗi lệch hash chunk (stale chunk sau khi deploy mới)
 * - Tránh màn hình trắng tinh, cung cấp nút tải lại trang hoặc quay về trang chủ
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, isChunkError: false };
    }

    static getDerivedStateFromError(error) {
        const msg = String(error?.message || error || '');
        const isChunkError =
            /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
                msg
            );
        return { hasError: true, isChunkError };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught an error:', error, info);

        // Tự động reload 1 lần duy nhất nếu gặp lỗi lệch hash chunk ngay sau khi deploy bản mới
        if (this.state.isChunkError && typeof window !== 'undefined') {
            const reloadKey = 'ta_hotel_chunk_reloaded';
            const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
            if (Date.now() - lastReload > 15000) {
                sessionStorage.setItem(reloadKey, String(Date.now()));
                window.location.reload();
            }
        }
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
                    <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-7 h-7" />
                        </div>

                        <div className="space-y-1.5">
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                                {this.state.isChunkError
                                    ? 'Hệ thống vừa được cập nhật phiên bản mới'
                                    : 'Đã xảy ra sự cố hiển thị tạm thời'}
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                                {this.state.isChunkError
                                    ? 'Vui lòng tải lại trang để cập nhật phiên bản mới nhất của Khách Sạn TA Đà Nẵng.'
                                    : 'Rất xin lỗi vì sự bất tiện này. Bạn có thể tải lại trang hoặc quay về trang chủ để tiếp tục.'}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <RotateCw className="w-4 h-4" />
                                <span>Tải lại trang</span>
                            </button>
                            <button
                                type="button"
                                onClick={this.handleGoHome}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Home className="w-4 h-4" />
                                <span>Về trang chủ</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
