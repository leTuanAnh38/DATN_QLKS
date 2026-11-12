import React, { useState, useEffect } from 'react';
import {
    KeyRound,
    X,
    Mail,
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    CheckCircle2,
    Loader2,
    RotateCcw,
    ArrowRight,
    ShieldCheck,
    Clock
} from 'lucide-react';
import { authService } from '../../services/authService';

export default function ForgotPasswordModal({ isOpen, onClose, onSuccess }) {
    // step: 1 = Nhập Email, 2 = Nhập OTP & Mật khẩu mới, 3 = Thành công
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Bộ đếm ngược 60 giây gửi lại mã OTP
    const [countdown, setCountdown] = useState(0);

    // Reset state khi mở Modal
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setEmail('');
            setOtpCode('');
            setNewPassword('');
            setConfirmPassword('');
            setErrorMessage(null);
            setSuccessMessage(null);
            setIsLoading(false);
            setResendLoading(false);
            setCountdown(0);
        }
    }, [isOpen]);

    // Đồng hồ đếm ngược 60s
    useEffect(() => {
        let timer = null;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [countdown]);

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

    // BƯỚC 1: Gửi mã OTP về Email
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        const cleanEmail = email.trim();
        if (!cleanEmail) {
            setErrorMessage('Vui lòng nhập địa chỉ email của quý khách.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await authService.forgotPassword(cleanEmail);
            if (res.success) {
                setStep(2);
                setSuccessMessage(res.message);
                setCountdown(60); // Bắt đầu đếm ngược 60 giây
            } else {
                setErrorMessage(res.message || 'Không thể gửi mã xác thực. Vui lòng thử lại.');
            }
        } catch {
            setErrorMessage('Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.');
        } finally {
            setIsLoading(false);
        }
    };

    // Gửi lại mã OTP (Resend)
    const handleResendOtp = async () => {
        if (countdown > 0 || resendLoading) return;
        setErrorMessage(null);
        setResendLoading(true);

        try {
            const res = await authService.forgotPassword(email.trim());
            if (res.success) {
                setSuccessMessage('Mã xác thực mới đã được gửi lại vào email của bạn!');
                setCountdown(60);
            } else {
                setErrorMessage(res.message);
            }
        } catch {
            setErrorMessage('Không thể gửi lại mã xác thực. Vui lòng thử lại.');
        } finally {
            setResendLoading(false);
        }
    };

    // BƯỚC 2: Xác nhận OTP & Đổi mật khẩu mới
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        const cleanOtp = otpCode.trim();
        if (!cleanOtp || cleanOtp.length !== 6) {
            setErrorMessage('Mã OTP xác thực phải gồm đúng 6 chữ số.');
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            setErrorMessage('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage('Mật khẩu xác nhận không trùng khớp với mật khẩu mới.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await authService.resetPassword({
                email: email.trim(),
                otp_code: cleanOtp,
                new_password: newPassword,
                confirm_password: confirmPassword,
            });

            if (res.success) {
                setStep(3); // Chuyển sang màn hình thành công
                setSuccessMessage(res.message);
            } else {
                setErrorMessage(res.message || 'Đặt lại mật khẩu không thành công.');
            }
        } catch {
            setErrorMessage('Đã xảy ra lỗi khi đặt lại mật khẩu. Vui lòng thử lại sau.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Modal */}
                <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/30">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs">
                                <KeyRound className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-sans font-bold text-lg text-slate-800">
                                    Khôi Phục Mật Khẩu
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Lấy lại quyền truy cập tài khoản khách hàng
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Thanh tiến trình 2 bước */}
                    {step < 3 && (
                        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100/80">
                            <div className={`flex items-center gap-2 text-xs font-semibold ${step === 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    1
                                </span>
                                <span>Nhập Email</span>
                            </div>
                            <div className="flex-1 h-0.5 bg-slate-100 mx-1">
                                <div className={`h-full bg-sky-600 transition-all duration-300 ${step === 2 ? 'w-full' : 'w-0'}`} />
                            </div>
                            <div className={`flex items-center gap-2 text-xs font-semibold ${step === 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    2
                                </span>
                                <span>Xác thực OTP & Đổi mật khẩu</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Body Modal */}
                <div className="p-6">
                    {/* Thông báo lỗi */}
                    {errorMessage && (
                        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                            <div className="leading-relaxed">{errorMessage}</div>
                        </div>
                    )}

                    {/* Thông báo thành công tạm thời */}
                    {successMessage && step === 2 && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                            <div className="leading-relaxed">{successMessage}</div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* BƯỚC 1: FORM NHẬP EMAIL */}
                    {/* ============================================================ */}
                    {step === 1 && (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Địa chỉ Email đăng ký tài khoản <span className="text-amber-600">*</span>
                                </label>
                                <div className="relative group">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Ví dụ: nguyenvan@gmail.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 focus:bg-white rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                    />
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors pointer-events-none">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                                    Hệ thống sẽ gửi một mã OTP gồm 6 chữ số đến hòm thư này để xác minh quyền sở hữu tài khoản.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-sky-900/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Đang gửi mã xác thực...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Tiếp Tục & Nhận Mã OTP</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* ============================================================ */}
                    {/* BƯỚC 2: FORM NHẬP OTP & MẬT KHẨU MỚI */}
                    {/* ============================================================ */}
                    {step === 2 && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            {/* Email đã gửi */}
                            <div className="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-xs">
                                <div className="truncate">
                                    <span className="text-slate-500 block text-[10px]">Đã gửi mã OTP đến:</span>
                                    <strong className="text-slate-800 font-semibold">{email}</strong>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep(1);
                                        setErrorMessage(null);
                                    }}
                                    className="text-amber-700 hover:text-amber-800 text-[11px] font-bold hover:underline cursor-pointer flex-shrink-0 ml-2"
                                >
                                    Đổi email
                                </button>
                            </div>

                            {/* Ô nhập mã OTP 6 số */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Mã xác thực OTP (6 chữ số) <span className="text-amber-600">*</span>
                                    </label>
                                    <div className="text-[11px] text-slate-500">
                                        {countdown > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                                <Clock className="w-3 h-3" />
                                                Gửi lại sau {countdown}s
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleResendOtp}
                                                disabled={resendLoading}
                                                className="text-amber-600 hover:text-amber-700 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                                            >
                                                <RotateCcw className={`w-3 h-3 ${resendLoading ? 'animate-spin' : ''}`} />
                                                <span>Gửi lại mã</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        required
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Nhập 6 chữ số (VD: 682914)"
                                        className="w-full text-center tracking-[6px] font-mono text-base font-bold py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 focus:bg-white rounded-xl text-slate-900 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs transition outline-none"
                                    />
                                </div>
                            </div>

                            {/* Mật khẩu mới */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Mật khẩu mới <span className="text-amber-600">*</span>
                                </label>
                                <div className="relative group">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        required
                                        minLength={6}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Tối thiểu 6 ký tự"
                                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 focus:bg-white rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                    />
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors pointer-events-none">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                    >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Xác nhận mật khẩu mới */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Xác nhận mật khẩu mới <span className="text-amber-600">*</span>
                                </label>
                                <div className="relative group">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required
                                        minLength={6}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu mới"
                                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 focus:bg-white rounded-xl text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none"
                                    />
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors pointer-events-none">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-sky-900/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Đang xác thực & Đổi mật khẩu...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>Xác Nhận Đặt Lại Mật Khẩu</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* ============================================================ */}
                    {/* BƯỚC 3: MÀN HÌNH HOÀN TẤT THÀNH CÔNG */}
                    {/* ============================================================ */}
                    {step === 3 && (
                        <div className="text-center py-4 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="font-sans font-bold text-lg text-slate-800">
                                    Đặt Lại Mật Khẩu Thành Công!
                                </h4>
                                <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                                    Mật khẩu mới cho tài khoản <strong>{email}</strong> đã được cập nhật an toàn. Quý khách có thể đăng nhập ngay bây giờ.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    if (onSuccess) onSuccess(email);
                                }}
                                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-2"
                            >
                                <span>Đăng Nhập Ngay Với Mật Khẩu Mới</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
