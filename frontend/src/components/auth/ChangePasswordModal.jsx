import React, { useState, useEffect } from 'react';
import {
    KeyRound,
    X,
    Eye,
    EyeOff,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Modal Card */}
            <div
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-left"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Header Modal (Fixed Non-Scrolling) */}
                <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                            <KeyRound className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg tracking-tight">Đổi Mật Khẩu</h3>
                            <p className="text-xs text-slate-500">Cập nhật mật khẩu bảo mật tài khoản</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                        title="Đóng (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form enclosing Body + Sticky Footer */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* 2. Form Body (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Error Alert */}
                        {errorMessage && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5 animate-fadeIn">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span className="flex-1 font-medium">{errorMessage}</span>
                            </div>
                        )}

                        {/* Success Alert */}
                        {successMessage && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2.5 animate-fadeIn">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="flex-1 font-medium">{successMessage}</span>
                            </div>
                        )}

                        {/* Input: Mật khẩu hiện tại */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Mật khẩu hiện tại <span className="text-rose-500">*</span>
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
                                    title={showOld ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                    {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Input: Mật khẩu mới */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Mật khẩu mới <span className="text-rose-500">*</span>
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
                                    title={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Input: Xác nhận mật khẩu mới */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
                                    title={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 3. Actions (Sticky Bottom) */}
                    <div className="shrink-0 px-6 py-4 bg-slate-50/90 backdrop-blur-xs flex items-center justify-end gap-2.5 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-75 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <span>Lưu Thay Đổi</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

