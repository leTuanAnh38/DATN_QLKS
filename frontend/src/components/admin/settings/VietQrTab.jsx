import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    Sparkles,
    ChevronDown,
    Search
} from 'lucide-react';
import { POPULAR_BANKS } from '../../../utils/constants';
import { formatDateTime } from '../../../utils/formatters';

// Chuẩn hóa tên chủ tài khoản ngân hàng: in hoa không dấu chuẩn Napas247/VietQR
const normalizeAccountName = (val) =>
    String(val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toUpperCase();

// Chuẩn hóa chuỗi tìm kiếm không dấu
const normalizeSearch = (val) =>
    String(val || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();

// Cache danh sách ~60+ ngân hàng chính thức từ API VietQR trong suốt phiên làm việc
let cachedVietQrBanks = null;

function BankLogo({ src, alt, className = 'w-14 h-7' }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return (
            <div className={`${className} rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0`}>
                <Building2 className="w-3.5 h-3.5" />
            </div>
        );
    }

    return (
        <div className={`${className} rounded-lg bg-white border border-slate-200/80 px-1.5 py-0.5 flex items-center justify-center overflow-hidden shrink-0`}>
            <img
                src={src}
                alt={alt || 'Bank logo'}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
                className="max-w-full max-h-full object-contain"
            />
        </div>
    );
}

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
    const [bankList, setBankList] = useState(() => cachedVietQrBanks || POPULAR_BANKS);
    const [isLoadingBanks, setIsLoadingBanks] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [bankSearch, setBankSearch] = useState('');

    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    // Tải danh sách đầy đủ ngân hàng kèm logo chính thức từ API công khai VietQR (có cache)
    useEffect(() => {
        if (cachedVietQrBanks) return;
        let isMounted = true;
        setIsLoadingBanks(true);

        fetch('https://api.vietqr.io/v2/banks')
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (!isMounted || !json || !Array.isArray(json.data)) return;
                const popularOrder = new Map(POPULAR_BANKS.map((b, i) => [String(b.bin), i]));
                const apiBanks = json.data
                    .filter((b) => b && b.bin && b.transferSupported !== 0)
                    .map((b) => ({
                        bin: String(b.bin),
                        code: b.code || '',
                        shortName: b.shortName || b.short_name || b.code || b.name,
                        fullName: b.name || b.shortName || '',
                        logo: b.logo || ''
                    }));

                // Đưa 15 ngân hàng phổ biến lên đầu danh sách, sau đó sắp xếp theo tên viết tắt
                apiBanks.sort((a, b) => {
                    const pa = popularOrder.has(a.bin) ? popularOrder.get(a.bin) : 999;
                    const pb = popularOrder.has(b.bin) ? popularOrder.get(b.bin) : 999;
                    if (pa !== pb) return pa - pb;
                    return a.shortName.localeCompare(b.shortName, 'vi');
                });

                if (apiBanks.length > 0) {
                    cachedVietQrBanks = apiBanks;
                    setBankList(apiBanks);
                }
            })
            .catch(() => {
                // Giữ nguyên fallback POPULAR_BANKS có sẵn logo CDN
            })
            .finally(() => {
                if (isMounted) setIsLoadingBanks(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Tự động đóng dropdown khi tắt chế độ chỉnh sửa
    useEffect(() => {
        if (!isEditingQr) {
            setIsDropdownOpen(false);
            setBankSearch('');
        }
    }, [isEditingQr]);

    // Đóng dropdown khi click ra ngoài hoặc nhấn Escape
    useEffect(() => {
        if (!isDropdownOpen) return;
        const handleOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        window.addEventListener('keydown', handleEsc);
        setTimeout(() => searchInputRef.current?.focus(), 30);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isDropdownOpen]);

    // Tìm thông tin ngân hàng hiện tại trong danh sách đầy đủ (ưu tiên có logo)
    const activeBank = useMemo(() => {
        const binStr = String(qrFormData.bank_bin || '').trim();
        if (!binStr) return null;
        return (
            bankList.find((b) => String(b.bin) === binStr) ||
            currentBank ||
            null
        );
    }, [bankList, qrFormData.bank_bin, currentBank]);

    // Lọc danh sách ngân hàng theo từ khóa
    const filteredBanks = useMemo(() => {
        const q = normalizeSearch(bankSearch);
        if (!q) return bankList;
        return bankList.filter((b) =>
            normalizeSearch(`${b.shortName} ${b.code || ''} ${b.fullName} ${b.bin}`).includes(q)
        );
    }, [bankList, bankSearch]);

    const handlePickBank = (bank) => {
        onSelectBank(bank.bin);
        setIsDropdownOpen(false);
        setBankSearch('');
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs animate-fadeIn">
            {/* Header gọn chuẩn Compact PMS kèm nút Cập nhật / Lưu ngay phía trên */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 rounded-t-2xl bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/25 shrink-0">
                        <QrCode className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900">
                                Cấu hình Thanh toán VietQR (Napas247)
                            </h2>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                Động (Dynamic)
                            </span>
                            {isEditingQr ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                    Đang chỉnh sửa
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    Chế độ xem
                                </span>
                            )}
                        </div>
                        <p className="text-[11.5px] text-slate-500 mt-0.5 truncate">
                            Thông tin tài khoản thụ hưởng nhận tiền chuyển khoản đặt phòng tự động
                        </p>
                    </div>
                </div>

                {/* Cột phải Header: Ngày cập nhật + Nút thao tác luôn nằm trong khung nhìn */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {qrLastUpdated && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white/90 px-2.5 py-1.5 rounded-xl border border-slate-200/80">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Cập nhật: <strong className="text-slate-700">{formatDateTime(qrLastUpdated)}</strong></span>
                        </div>
                    )}

                    {!isEditingQr ? (
                        canUpdateSettings && (
                            <button
                                type="button"
                                onClick={onStartEdit}
                                disabled={isLoading}
                                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-blue-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Cập nhật cấu hình</span>
                            </button>
                        )
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onCancelEdit}
                                disabled={isSavingQr}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                            >
                                <X className="w-3.5 h-3.5 text-slate-400" />
                                <span>Hủy</span>
                            </button>
                            <button
                                type="button"
                                onClick={onSubmit}
                                disabled={isSavingQr}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                                {isSavingQr ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Đang lưu...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Lưu cấu hình</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 sm:p-5">
                {isLoading ? (
                    <div className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-7 h-7 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-600">Đang tải cấu hình thanh toán...</p>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* CỘT TRÁI: FORM CHỌN NGÂN HÀNG + 3 INPUT CHÍNH (7 CỘT) */}
                        <div className="lg:col-span-7 space-y-3.5">
                            {/* Hướng dẫn gọn 1 dòng */}
                            <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 flex items-center gap-2.5">
                                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                                <p className="text-blue-800 leading-snug">
                                    {isEditingQr ? (
                                        <span>Đang chỉnh sửa — chọn ngân hàng từ danh sách bên dưới rồi bấm <strong>&ldquo;Lưu cấu hình&rdquo;</strong> để áp dụng ngay.</span>
                                    ) : (
                                        <span>Chế độ xem an toàn. Bấm <strong>&ldquo;Cập nhật cấu hình&rdquo;</strong> ở góc trên để thay đổi ngân hàng hoặc số tài khoản.</span>
                                    )}
                                </p>
                            </div>

                            {/* CHỌN NGÂN HÀNG CÓ LOGO + Ô TÌM KIẾM NHANH (TỪ API VIETQR ~60+ NGÂN HÀNG) */}
                            <div className="space-y-1.5 relative" ref={dropdownRef}>
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Ngân Hàng Thụ Hưởng</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10.5px] text-slate-400 font-medium">
                                        {isLoadingBanks
                                            ? 'Đang tải danh sách ngân hàng...'
                                            : isEditingQr
                                                ? `${bankList.length} ngân hàng hỗ trợ VietQR`
                                                : '(Bấm "Cập nhật cấu hình" để đổi)'}
                                    </span>
                                </div>

                                {/* Nút Trigger hiển thị Logo + Tên + BIN ngân hàng đang chọn */}
                                <button
                                    type="button"
                                    disabled={!isEditingQr}
                                    onClick={() => isEditingQr && setIsDropdownOpen((prev) => !prev)}
                                    className={`w-full px-3 py-2 rounded-xl border text-left transition flex items-center justify-between gap-2.5 shadow-2xs ${
                                        !isEditingQr
                                            ? 'bg-slate-100/75 border-slate-200 cursor-not-allowed'
                                            : isDropdownOpen
                                                ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 cursor-pointer'
                                                : 'bg-white border-slate-200 hover:border-blue-400 cursor-pointer'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <BankLogo
                                            src={activeBank?.logo}
                                            alt={activeBank?.shortName}
                                            className="w-16 h-8"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                                    {activeBank ? activeBank.shortName : (qrFormData.bank_bin ? `Mã BIN ${qrFormData.bank_bin}` : 'Chọn ngân hàng thụ hưởng...')}
                                                </span>
                                                {activeBank?.code && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
                                                        {activeBank.code}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {activeBank?.fullName || 'Chọn từ danh sách hơn 60 ngân hàng Napas247'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {qrFormData.bank_bin && (
                                            <span className="hidden sm:inline-block font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                {qrFormData.bank_bin}
                                            </span>
                                        )}
                                        <ChevronDown
                                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                                                isDropdownOpen ? 'rotate-180 text-blue-600' : ''
                                            }`}
                                        />
                                    </div>
                                </button>

                                {/* Menu thả xuống: Ô tìm kiếm + Danh sách đầy đủ ngân hàng có ảnh logo */}
                                {isDropdownOpen && isEditingQr && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                        {/* Ô tìm kiếm dính trên cùng */}
                                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                <input
                                                    ref={searchInputRef}
                                                    type="text"
                                                    value={bankSearch}
                                                    onChange={(e) => setBankSearch(e.target.value)}
                                                    placeholder="Tìm ngân hàng (VD: MB, Vietcombank, BIDV, 970422)..."
                                                    className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                />
                                                {bankSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setBankSearch('')}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Danh sách ngân hàng cuộn mượt */}
                                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100/80 p-1">
                                            {filteredBanks.length === 0 ? (
                                                <div className="py-6 text-center text-xs text-slate-400">
                                                    Không tìm thấy ngân hàng phù hợp với &ldquo;{bankSearch}&rdquo;
                                                </div>
                                            ) : (
                                                filteredBanks.map((bank) => {
                                                    const isSelected = String(qrFormData.bank_bin) === String(bank.bin);
                                                    return (
                                                        <button
                                                            key={`${bank.bin}-${bank.code}`}
                                                            type="button"
                                                            onClick={() => handlePickBank(bank)}
                                                            className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-blue-50 text-blue-900'
                                                                    : 'hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <BankLogo src={bank.logo} alt={bank.shortName} className="w-14 h-7" />
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-bold text-slate-900 truncate">
                                                                            {bank.shortName}
                                                                        </span>
                                                                        {bank.code && (
                                                                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                                                                {bank.code}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10.5px] text-slate-500 truncate">
                                                                        {bank.fullName}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className={`font-mono text-[10.5px] px-1.5 py-0.5 rounded ${
                                                                    isSelected ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    {bank.bin}
                                                                </span>
                                                                {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* INPUT 1: MÃ BIN NGÂN HÀNG (Đồng bộ 2 chiều với ô chọn ngân hàng) */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <label htmlFor="bank_bin" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <QrCode className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Mã BIN Ngân Hàng (Tự điền khi chọn ở trên)</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    {activeBank && (
                                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                            <span>{activeBank.shortName}</span>
                                        </span>
                                    )}
                                </div>
                                <input
                                    id="bank_bin"
                                    type="text"
                                    value={qrFormData.bank_bin}
                                    onChange={(e) => setQrFormData({ ...qrFormData, bank_bin: e.target.value.replace(/\D/g, '') })}
                                    placeholder="Ví dụ: 970422 (MB Bank), 970436 (VCB)..."
                                    disabled={!isEditingQr}
                                    required
                                    className={`w-full px-3.5 py-2 rounded-xl border text-sm font-mono font-medium transition shadow-2xs ${
                                        !isEditingQr
                                            ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed select-none'
                                            : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                                />
                            </div>

                            {/* INPUT 2: SỐ TÀI KHOẢN */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="account_no" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
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
                                    className={`w-full px-3.5 py-2 rounded-xl border text-sm font-mono font-bold tracking-wider transition shadow-2xs ${
                                        !isEditingQr
                                            ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed select-none'
                                            : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                                />
                            </div>

                            {/* INPUT 3: TÊN CHỦ TÀI KHOẢN (Tự động khử dấu tiếng Việt + In hoa) */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="account_name" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
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
                                    onChange={(e) => setQrFormData({ ...qrFormData, account_name: normalizeAccountName(e.target.value) })}
                                    placeholder="Ví dụ: KHACH SAN TA DA NANG, NGUYEN VAN A..."
                                    disabled={!isEditingQr}
                                    required
                                    className={`w-full px-3.5 py-2 rounded-xl border text-sm font-bold uppercase tracking-wide transition shadow-2xs ${
                                        !isEditingQr
                                            ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed select-none'
                                            : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                                />
                            </div>
                        </div>

                        {/* CỘT PHẢI: LIVE PREVIEW QR (5 CỘT) */}
                        <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs mb-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Xem trước mã VietQR khách hàng sẽ thấy
                            </div>

                            <div className="relative p-2 bg-white rounded-2xl border-2 border-dashed border-blue-400 shadow-sm max-w-[205px] w-full aspect-square flex items-center justify-center overflow-hidden">
                                {previewQrUrl ? (
                                    <img
                                        src={previewQrUrl}
                                        alt="Preview VietQR"
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                ) : (
                                    <div className="text-xs text-slate-400 flex flex-col items-center gap-2">
                                        <QrCode className="w-7 h-7 text-slate-300" />
                                        <span>Nhập đủ thông tin để tạo mã</span>
                                    </div>
                                )}
                            </div>

                            <div className="w-full mt-3 bg-white rounded-xl p-3 border border-slate-200/70 text-left space-y-1.5 text-xs">
                                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                    <span className="text-slate-500 shrink-0">Ngân hàng:</span>
                                    <div className="flex items-center gap-1.5 min-w-0 justify-end">
                                        {activeBank?.logo && (
                                            <img
                                                src={activeBank.logo}
                                                alt={activeBank.shortName}
                                                className="h-4 w-auto object-contain shrink-0"
                                            />
                                        )}
                                        <strong className="text-slate-900 font-semibold truncate max-w-[150px]">
                                            {activeBank?.shortName || qrFormData.bank_bin || '—'}
                                        </strong>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                    <span className="text-slate-500">Số tài khoản:</span>
                                    <span className="font-mono font-bold text-slate-900">
                                        {qrFormData.account_no || '—'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Chủ tài khoản:</span>
                                    <strong className="text-slate-900 font-bold uppercase truncate max-w-[180px]">
                                        {qrFormData.account_name || '—'}
                                    </strong>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>Mã QR tự động làm mới ngay khi bạn thay đổi thông tin.</span>
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
