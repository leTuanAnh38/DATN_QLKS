import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';

export default function ChangePasswordModal({ isOpen, onClose }) {
    const [formData, setFormData] = useState({
        old_password: '',
        new_password: '',
        confirm_password: '',
    });

    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Reset state khi mở modal
    useEffect(() => {
        if (isOpen) {
            setFormData({
                old_password: '',
                new_password: '',
                confirm_password: '',
            });
            setErrorMessage(null);
            setSuccessMessage(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    // Nhấn phím Escape để đóng modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        if (formData.new_password !== formData.confirm_password) {
            setErrorMessage('Mật khẩu xác nhận không trùng khớp với mật khẩu mới.');
            return;
        }

        if (formData.new_password.length < 6) {
            setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự.');
            return;
        }

        if (formData.old_password === formData.new_password) {
            setErrorMessage('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
            return;
        }

        setIsLoading(true);
        const result = await authService.changePassword(formData);
        setIsLoading(false);

        if (result.success) {
            setSuccessMessage(result.message || 'Đổi mật khẩu thành công! Mật khẩu mới đã được lưu.');
            setTimeout(() => {
                onClose();
            }, 1200);
        } else {
            setErrorMessage(result.message || 'Đổi mật khẩu không thành công. Vui lòng kiểm tra lại mật khẩu cũ.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            {/* Modal Card */}
            <div
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Modal */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-serif font-bold text-slate-900 text-lg">Đổi Mật Khẩu</h3>
                            <p className="text-xs text-slate-500">Cập nhật mật khẩu bảo mật tài khoản</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
                        title="Đóng (Esc)"
                    >
                        ✕
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Error Alert */}
                    {errorMessage && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2 animate-fadeIn">
                            <span className="text-sm">⚠️</span>
                            <span className="flex-1 font-medium">{errorMessage}</span>
                        </div>
                    )}

                    {/* Success Alert */}
                    {successMessage && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2 animate-fadeIn">
                            <span className="text-sm">✅</span>
                            <span className="flex-1 font-medium">{successMessage}</span>
                        </div>
                    )}

                    {/* Input: Mật khẩu hiện tại */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mật khẩu hiện tại <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showOld ? 'text' : 'password'}
                                required
                                value={formData.old_password}
                                onChange={(e) => setFormData({ ...formData, old_password: e.target.value })}
                                placeholder="Nhập mật khẩu đang sử dụng"
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowOld(!showOld)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                            >
                                {showOld ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                    </div>

                    {/* Input: Mật khẩu mới */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mật khẩu mới <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={formData.new_password}
                                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                                placeholder="Tối thiểu 6 ký tự"
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                            >
                                {showNew ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                    </div>

                    {/* Input: Xác nhận mật khẩu mới */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={formData.confirm_password}
                                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                                placeholder="Nhập lại mật khẩu mới"
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                            >
                                {showConfirm ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-75 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
                        >
                            {isLoading && (
                                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            <span>{isLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
