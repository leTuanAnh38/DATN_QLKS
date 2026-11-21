import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, Copy, Clock, AlertCircle } from 'lucide-react';
import { BANK_NAMES_BY_BIN } from '../../common/PaymentModal';

/**
 * Modal thành công & Thanh toán VietQR đơn đặt phòng đoàn
 */
export default function CorporateSuccessModal({
    createdGroup,
    isPaidSuccess = false,
    hotelSettings = {},
    bankConfig = {
        bank_bin: '970422',
        account_no: '0344997778',
        account_name: 'KHACH SAN TA DA NANG'
    },
    formatCurrency = (val) => `${(Number(val) || 0).toLocaleString('vi-VN')} VND`
}) {
    const navigate = useNavigate();
    const [copiedField, setCopiedField] = useState(null);
    const [timerState, setTimerState] = useState({ code: null, left: 900 }); // 15 phút giữ phòng đoàn
    const [failedQrSrc, setFailedQrSrc] = useState('');

    const currentGroupCode = createdGroup?.group_code || null;
    const timeLeft = timerState.code === currentGroupCode ? timerState.left : 900;

    useEffect(() => {
        if (!currentGroupCode || isPaidSuccess) return;
        const timer = setInterval(() => {
            setTimerState((prev) => {
                const baseLeft = prev.code === currentGroupCode ? prev.left : 900;
                return { code: currentGroupCode, left: Math.max(0, baseLeft - 1) };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [currentGroupCode, isPaidSuccess]);

    if (!createdGroup) return null;

    const formatTimer = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isFull = createdGroup.payment_option === 'FULL';
    const qrNote = isFull ? `TT toan doan ${createdGroup.group_code}` : `Coc doan ${createdGroup.group_code}`;
    const bankDisplayName = bankConfig.bank_name || BANK_NAMES_BY_BIN[bankConfig.bank_bin]?.short || 'Napas247';
    const qrImageSrc = `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${createdGroup.deposit_amount}&addInfo=${encodeURIComponent(qrNote)}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
    const qrImageError = failedQrSrc === qrImageSrc;

    const handleCopy = async (text, field) => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Không thể sao chép nội dung:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white text-slate-900 rounded-3xl p-4 sm:p-8 max-w-lg w-full text-center space-y-4 sm:space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {isPaidSuccess ? (
                    /* MÀN HÌNH TỰ ĐỘNG XÁC NHẬN THANH TOÁN THÀNH CÔNG */
                    <div className="space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/40">
                            <Check className="w-10 h-10" />
                        </div>
                        <div>
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                                Đã Nhận Tiền Thành Công
                            </span>
                            <h3 className="font-serif text-2xl font-black text-slate-900 mt-2">
                                {isFull ? 'Tất Toán Hợp Đồng Đoàn Thành Công!' : 'Xác Nhận Đặt Cọc Đoàn Thành Công!'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Hệ thống đã nhận được tiền chuyển khoản VietQR cho đơn đoàn <strong className="font-mono text-amber-700 font-black">#{createdGroup.group_code}</strong>.
                            </p>
                        </div>

                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-left text-xs space-y-2 font-sans tabular-nums">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Trạng thái hợp đồng:</span>
                                <strong className="text-emerald-700 font-bold">Đã xác nhận (Confirmed)</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Quy mô đoàn:</span>
                                <strong className="text-slate-900">{createdGroup.total_rooms} phòng</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Tổng giá trị hợp đồng:</span>
                                <strong className="text-slate-900">{formatCurrency(createdGroup.total_amount)}</strong>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-emerald-200/80 font-bold">
                                <span className="text-slate-700">
                                    {isFull ? 'Số tiền đã tất toán (100%):' : `Số tiền cọc đã thanh toán (${hotelSettings.group_deposit_percent || 50}%):`}
                                </span>
                                <strong className="text-emerald-600 text-sm">{formatCurrency(createdGroup.deposit_amount)}</strong>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/booking-history')}
                                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/20 transition cursor-pointer"
                            >
                                Xem Lịch Sử Đặt Phòng
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                            >
                                Về Trang Chủ
                            </button>
                        </div>
                    </div>
                ) : (
                    /* MÀN HÌNH QUÉT MÃ VIETQR VÀ CHỜ CHUYỂN KHOẢN */
                    <>
                        <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="font-serif text-2xl font-bold text-slate-900">
                                {isFull ? 'Thanh Toán Hợp Đồng Đoàn 100%' : `Thanh Toán Đặt Cọc Đoàn ${hotelSettings.group_deposit_percent || 50}%`}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Mã đơn đoàn của quý khách: <strong className="font-mono text-amber-700 font-black text-sm">#{createdGroup.group_code}</strong>
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2 font-sans tabular-nums">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Quy mô đoàn:</span>
                                <strong className="text-slate-900">{createdGroup.total_rooms} phòng</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Tổng tiền hợp đồng:</span>
                                <strong className="text-slate-900">{formatCurrency(createdGroup.total_amount)}</strong>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-200 font-bold">
                                <span className="text-slate-700">
                                    {isFull ? 'Số tiền thanh toán tất cả (100%):' : `Tiền đặt cọc cần thanh toán (${hotelSettings.group_deposit_percent || 50}%):`}
                                </span>
                                <strong className="text-amber-700 text-sm">{formatCurrency(createdGroup.deposit_amount)}</strong>
                            </div>
                        </div>

                        {/* Mã VietQR cọc tự động từ cấu hình hệ thống */}
                        <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-2xl inline-block mx-auto max-w-sm w-full">
                            {/* Đồng hồ đếm ngược giữ chỗ 15 phút */}
                            <div className="flex items-center justify-center gap-1.5 mb-2.5 text-[11px] font-bold text-amber-900 bg-amber-100/80 border border-amber-200 rounded-xl py-1 px-3">
                                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>
                                    {timeLeft > 0
                                        ? `Thời gian giữ phòng đoàn còn lại: ${formatTimer(timeLeft)}`
                                        : 'Đã hết thời gian giữ chỗ 15 phút — vui lòng liên hệ lễ tân nếu cần gia hạn'}
                                </span>
                            </div>

                            {qrImageError ? (
                                <div className="w-48 h-48 mx-auto rounded-xl bg-white border border-dashed border-amber-300 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500 gap-2">
                                    <AlertCircle className="w-6 h-6 text-amber-500" />
                                    <span>Không thể tải ảnh QR. Quý khách vui lòng chuyển khoản thủ công theo thông tin bên dưới.</span>
                                </div>
                            ) : (
                                <img
                                    src={qrImageSrc}
                                    alt="VietQR Payment"
                                    onError={() => setFailedQrSrc(qrImageSrc)}
                                    className="w-48 h-48 mx-auto rounded-xl object-contain shadow-xs bg-white p-1"
                                />
                            )}

                            {/* Trạng thái lắng nghe giao dịch realtime */}
                            <div className="flex items-center justify-center gap-2 py-1.5 px-3 mt-2 text-[11px] text-amber-900 font-bold bg-white rounded-xl border border-amber-200 shadow-2xs">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                                <span>Đang chờ nhận tiền chuyển khoản... (Tự động xác nhận)</span>
                            </div>

                            {/* Khung chi tiết thông tin chuyển khoản */}
                            <div className="mt-3 p-3 bg-white rounded-xl border border-amber-100 text-left text-xs space-y-2 shadow-2xs font-sans tabular-nums">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="text-slate-500 text-[11px] shrink-0">Ngân hàng:</span>
                                    <strong className="text-slate-900 font-bold text-right">{bankDisplayName} ({bankConfig.bank_bin})</strong>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="text-slate-500 text-[11px] shrink-0">Số tài khoản:</span>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <strong className="font-mono text-amber-700 font-extrabold text-xs break-all">{bankConfig.account_no}</strong>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(bankConfig.account_no, 'acc')}
                                            className="min-h-[36px] sm:min-h-0 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] sm:text-[10px] font-bold text-slate-700 cursor-pointer flex items-center gap-1 shrink-0"
                                            title="Sao chép số tài khoản"
                                        >
                                            {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 sm:w-3 sm:h-3" />}
                                            <span>{copiedField === 'acc' ? 'Đã chép' : 'Sao chép'}</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="text-slate-500 text-[11px] shrink-0">Chủ tài khoản:</span>
                                    <strong className="text-slate-900 uppercase text-[11px] font-bold text-right break-words min-w-0">{bankConfig.account_name}</strong>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                                    <span className="text-slate-500 text-[11px] shrink-0">Nội dung CK:</span>
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
                                        <strong className="font-mono text-amber-800 font-bold text-xs bg-amber-50 px-2 py-1 rounded border border-amber-200 break-all">
                                            {qrNote}
                                        </strong>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(qrNote, 'note')}
                                            className="min-h-[36px] sm:min-h-0 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] sm:text-[10px] font-bold text-slate-700 cursor-pointer flex items-center gap-1 shrink-0"
                                            title="Sao chép nội dung chuyển khoản"
                                        >
                                            {copiedField === 'note' ? <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 sm:w-3 sm:h-3" />}
                                            <span>{copiedField === 'note' ? 'Đã chép' : 'Sao chép'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 justify-center pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                            >
                                Về Trang Chủ
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

