import React from 'react';
import {
    QrCode,
    RefreshCw,
    Building2,
    Check,
    CreditCard,
    User,
    Copy,
    Edit3,
    Save,
    X,
    Info,
    ShieldCheck,
    Sparkles
} from 'lucide-react';
import { POPULAR_BANKS } from '../../../utils/constants';
import { formatDateTime } from '../../../utils/formatters';

export default function VietQrTab({
    qrFormData,
    setQrFormData,
    isEditingQr,
    isSavingQr,
    isLoading,
    qrLastUpdated,
    canUpdateSettings,
    onStartEdit,
    onCancelEdit,
    onSubmit,
    onSelectBank,
    onCopy,
    copiedField,
    previewQrUrl,
    currentBank,
}) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                        <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>Cấu hình Thanh toán VietQR (Napas247)</span>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                Động (Dynamic)
                            </span>
                            {isEditingQr ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                    Đang chỉnh sửa
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    Chế độ xem
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Thông tin tài khoản thụ hưởng nhận tiền chuyển khoản đặt phòng tự động
                        </p>
                    </div>
                </div>

                {qrLastUpdated && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cập nhật gần nhất: <strong className="text-slate-700">{formatDateTime(qrLastUpdated)}</strong></span>
                    </div>
                )}
            </div>

            <div className="p-6 sm:p-8">
                {isLoading ? (
                    <div className="py-16 text-center text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình thanh toán...</p>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* CỘT TRÁI: FORM 3 INPUT CHÍNH (7 CỘT) */}
                        <div className="lg:col-span-7 space-y-5">
                            {/* Hướng dẫn & Lưu ý */}
                            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 flex items-start gap-3">
                                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="font-semibold text-blue-950">
                                        Nguyên lý hoạt động mã QR động:
                                    </p>
                                    <p className="text-blue-800 leading-relaxed">
                                        {isEditingQr ? (
                                            <span>Bạn đang ở chế độ chỉnh sửa. Thay đổi số tài khoản hoặc ngân hàng bên dưới rồi bấm <strong>&ldquo;Lưu cấu hình&rdquo;</strong> để áp dụng ngay.</span>
                                        ) : (
                                            <span>Hệ thống đang ở chế độ xem an toàn. Bấm <strong>&ldquo;Cập nhật&rdquo;</strong> bên dưới để chỉnh sửa thông tin tài khoản thụ hưởng.</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Gợi ý chọn nhanh ngân hàng phổ biến */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                    <span>Chọn nhanh ngân hàng phổ biến:</span>
                                    {!isEditingQr && (
                                        <span className="text-[10px] text-slate-400 font-normal italic">
                                            (Bấm &ldquo;Cập nhật&rdquo; để chọn)
                                        </span>
                                    )}
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {POPULAR_BANKS.slice(0, 6).map((b) => {
                                        const isSelected = qrFormData.bank_bin === b.bin;
                                        return (
                                            <button
                                                key={b.bin}
                                                type="button"
                                                onClick={() => onSelectBank(b.bin)}
                                                disabled={!isEditingQr}
                                                className={`px-3 py-2 rounded-xl text-left border text-xs font-semibold transition flex items-center justify-between ${
                                                    !isEditingQr
                                                        ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-500'
                                                        : isSelected
                                                            ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-xs ring-1 ring-blue-600/20 cursor-pointer'
                                                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 cursor-pointer'
                                                }`}
                                            >
                                                <span className="truncate">{b.shortName}</span>
                                                <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-1">
                                                    {b.bin}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* INPUT 1: MÃ BIN NGÂN HÀNG */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="bank_bin" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Mã BIN Ngân Hàng</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    {currentBank && (
                                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>{currentBank.shortName} ({currentBank.fullName})</span>
                                        </span>
                                    )}
                                </div>
                                <input
                                    id="bank_bin"
                                    type="text"
                                    value={qrFormData.bank_bin}
                                    onChange={(e) => setQrFormData({ ...qrFormData, bank_bin: e.target.value })}
                                    placeholder="Ví dụ: 970422 (MB Bank), 970436 (VCB)..."
                                    disabled={!isEditingQr}
                                    required
                                    className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-medium transition shadow-xs ${
                                        !isEditingQr
                                            ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                            : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                                />
                            </div>

                            {/* INPUT 2: SỐ TÀI KHOẢN */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="account_no" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Số Tài Khoản Thụ Hưởng</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    {qrFormData.account_no && (
                                        <button
                                            type="button"
                                            onClick={() => onCopy(qrFormData.account_no, 'account_no')}
                                            className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
                                        >
                                            {copiedField === 'account_no' ? (
                                                <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                                                    <Check className="w-3 h-3" /> Đã sao chép
                                                </span>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" /> Sao chép
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="account_no"
                                    type="text"
                                    value={qrFormData.account_no}
                                    onChange={(e) => setQrFormData({ ...qrFormData, account_no: e.target.value.replace(/\s+/g, '') })}
                                    placeholder="Ví dụ: 123456789, 0905123456..."
                                    disabled={!isEditingQr}
                                    required
                                    className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold tracking-wider transition shadow-xs ${
                                        !isEditingQr
                                            ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                            : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                                />
                            </div>

                            {/* INPUT 3: TÊN CHỦ TÀI KHOẢN */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="account_name" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Tên Chủ Tài Khoản (In hoa không dấu)</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    {qrFormData.account_name && (
                                        <button
                                            type="button"
                                            onClick={() => onCopy(qrFormData.account_name, 'account_name')}
                                            className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
                                        >
                                            {copiedField === 'account_name' ? (
                                                <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                                                    <Check className="w-3 h-3" /> Đã sao chép
                                                </span>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" /> Sao chép
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="account_name"
                                    type="text"
                                    value={qrFormData.account_name}
                                    onChange={(e) => setQrFormData({ ...qrFormData, account_name: e.target.value.toUpperCase() })}
                                    placeholder="Ví dụ: KHACH SAN TA DA NANG, NGUYEN VAN A..."
                                    disabled={!isEditingQr}
                                    required
                                    className={`w-full px-4 py-3 rounded-xl border text-sm font-bold uppercase tracking-wide transition shadow-xs ${
                                        !isEditingQr
                                            ? 'bg-slate-100/70 text-slate-600 border-slate-200 cursor-not-allowed select-none'
                                            : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                                />
                            </div>

                            {/* NÚT THAO TÁC */}
                            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                {!isEditingQr ? (
                                    canUpdateSettings ? (
                                        <button
                                            type="button"
                                            onClick={onStartEdit}
                                            disabled={isLoading}
                                            className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                            <span>Cập nhật cấu hình</span>
                                        </button>
                                    ) : (
                                        <div className="text-xs text-slate-500">Chế độ xem</div>
                                    )
                                ) : (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="submit"
                                            disabled={isSavingQr}
                                            className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            {isSavingQr ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    <span>Đang lưu...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    <span>Lưu cấu hình</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onCancelEdit}
                                            disabled={isSavingQr}
                                            className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer flex items-center gap-1.5"
                                        >
                                            <X className="w-4 h-4 text-slate-400" />
                                            <span>Hủy</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CỘT PHẢI: LIVE PREVIEW QR (5 CỘT) */}
                        <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 flex flex-col items-center text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs mb-4">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Xem trước mã VietQR khách hàng sẽ thấy
                            </div>

                            <div className="relative p-2.5 bg-white rounded-2xl border-2 border-dashed border-blue-400 shadow-md max-w-[240px] w-full aspect-square flex items-center justify-center overflow-hidden">
                                {previewQrUrl ? (
                                    <img
                                        src={previewQrUrl}
                                        alt="Preview VietQR"
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                ) : (
                                    <div className="text-xs text-slate-400 flex flex-col items-center gap-2">
                                        <QrCode className="w-8 h-8 text-slate-300" />
                                        <span>Nhập đủ thông tin để tạo mã</span>
                                    </div>
                                )}
                            </div>

                            <div className="w-full mt-4 bg-white rounded-2xl p-4 border border-slate-200/70 text-left space-y-2 text-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <span className="text-slate-500">Ngân hàng:</span>
                                    <strong className="text-slate-900 font-semibold truncate max-w-[170px]">
                                        {currentBank?.shortName || qrFormData.bank_bin || '—'}
                                    </strong>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <span className="text-slate-500">Số tài khoản:</span>
                                    <span className="font-mono font-bold text-slate-900">
                                        {qrFormData.account_no || '—'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Chủ tài khoản:</span>
                                    <strong className="text-slate-900 font-bold uppercase truncate max-w-[170px]">
                                        {qrFormData.account_name || '—'}
                                    </strong>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>Mã QR trên tự động làm mới khi bạn gõ phím.</span>
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

