import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock,
    Banknote,
    FileText,
    AlertCircle,
    CheckCircle2,
    X,
    Users,
    ArrowRight,
    Calculator,
    Check,
    Coins,
    HelpCircle,
    AlertTriangle
} from 'lucide-react';
import paymentService from '../../../services/paymentService';
import adminUserService from '../../../services/adminUserService';
import { authStore } from '../../../store/authStore';

/**
 * Modal Kết Ca Làm Việc & Kiểm Đếm Quỹ Tiền Mặt (Close Shift / Shift Handover)
 */
export default function CloseShiftModal({ isOpen, onClose, shift, onShiftClosed }) {
    if (!isOpen || !shift) return null;

    // Danh sách các mệnh giá tiền VNĐ tiêu chuẩn
    const DENOMINATIONS_LIST = [
        { value: 500000, label: '500,000 đ' },
        { value: 200000, label: '200,000 đ' },
        { value: 100000, label: '100,000 đ' },
        { value: 50000, label: '50,000 đ' },
        { value: 20000, label: '20,000 đ' },
        { value: 10000, label: '10,000 đ' },
        { value: 5000, label: '5,000 đ' },
        { value: 2000, label: '2,000 đ' },
        { value: 1000, label: '1,000 đ' }
    ];

    // State lưu số tờ từng mệnh giá { 500000: 0, 200000: 0, ... }
    const [counts, setCounts] = useState(() => {
        const init = {};
        DENOMINATIONS_LIST.forEach(d => { init[d.value] = 0; });
        return init;
    });

    // Chế độ đếm: 'DENOMINATION' (Đếm từng tờ) hoặc 'DIRECT' (Nhập nhanh tổng tiền)
    const [countMode, setCountMode] = useState('DENOMINATION');
    const [directCash, setDirectCash] = useState('');

    // Dữ liệu tóm tắt tài chính ca làm việc từ Backend
    const [summary, setSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(true);

    // Danh sách nhân viên để chọn người nhận bàn giao
    const [staffList, setStaffList] = useState([]);
    const [handoverUserId, setHandoverUserId] = useState('');
    const [notes, setNotes] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Format tiền tệ VNĐ
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    };

    // Format thời gian
    const formatTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
            d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Tải tóm tắt ca trực và danh sách nhân viên khi mở Modal
    useEffect(() => {
        let isMounted = true;
        setLoadingSummary(true);
        setError(null);

        // 1. Tải Summary ca
        paymentService.getShiftSummary(shift.id)
            .then(res => {
                if (isMounted && res.success) {
                    setSummary(res.summary);
                }
            })
            .catch(err => {
                console.warn('Lỗi khi tải summary ca:', err);
            })
            .finally(() => {
                if (isMounted) setLoadingSummary(false);
            });

        // 2. Tải danh sách nhân viên trực ca tiếp theo
        adminUserService.getEmployees({ is_active: true })
            .then(res => {
                const list = res.employees || res.results || res.data || [];
                if (isMounted && Array.isArray(list)) {
                    // Chỉ lọc những nhân viên trực quầy phụ trách két tiền (Thu ngân & Lễ tân)
                    // Tuyệt đối loại trừ các bộ phận không liên quan (Chủ KS, Quản lý, Admin, Kỹ thuật, Dọn dẹp, Phục vụ)
                    // Và loại trừ chính người đang mở ca này (không thể tự bàn giao cho chính mình)
                    const loggedInUser = authStore.getUser();
                    const shiftOwnerId = (typeof shift.user === 'object' ? shift.user?.id : shift.user) || loggedInUser?.id;
                    const ALLOWED_HANDOVER_ROLES = ['cashier', 'receptionist'];

                    const filtered = list.filter(emp => {
                        const isDeskStaff = ALLOWED_HANDOVER_ROLES.includes(emp.role);
                        const isNotSelf = shiftOwnerId ? Number(emp.id) !== Number(shiftOwnerId) : true;
                        return isDeskStaff && isNotSelf;
                    });
                    setStaffList(filtered);
                }
            })
            .catch(err => console.warn('Lỗi tải danh sách nhân viên bàn giao ca:', err));

        return () => { isMounted = false; };
    }, [shift.id]);

    // Xử lý thay đổi số tờ của mệnh giá
    const handleCountChange = (val, countStr) => {
        const count = parseInt(countStr, 10) || 0;
        setCounts(prev => ({
            ...prev,
            [val]: Math.max(0, count)
        }));
    };

    // Tính tổng tiền mặt thực tế từ bảng đếm tờ
    const calculatedDenomTotal = useMemo(() => {
        return DENOMINATIONS_LIST.reduce((sum, item) => {
            const count = counts[item.value] || 0;
            return sum + (item.value * count);
        }, 0);
    }, [counts]);

    // Tổng tiền mặt thực tế (tùy theo mode)
    const actualCashTotal = useMemo(() => {
        if (countMode === 'DENOMINATION') {
            return calculatedDenomTotal;
        }
        return Number(directCash) || 0;
    }, [countMode, calculatedDenomTotal, directCash]);

    // Số liệu dòng tiền trong két (từ summary hoặc shift)
    const openingCash = Number(summary?.opening_cash ?? shift?.opening_cash ?? 0);
    const cashIn = Number(summary?.cash_in ?? summary?.total_cash_in ?? shift?.total_cash_in ?? 0);
    const cashOut = Number(summary?.cash_out ?? summary?.total_cash_out ?? shift?.total_cash_out ?? 0);
    const transferIn = Number(summary?.transfer_in ?? summary?.total_transfer_in ?? shift?.total_transfer_in ?? 0);
    const cardIn = Number(summary?.card_in ?? summary?.total_card_in ?? shift?.total_card_in ?? 0);
    const expectedCash = Number(summary?.expected_cash ?? (openingCash + cashIn - cashOut));

    // Chênh lệch thừa / thiếu quỹ tiền mặt
    const difference = actualCashTotal - expectedCash;

    // Gán nhanh số tiền thực tế = tiền lý thuyết
    const handleFillExpected = () => {
        setCountMode('DIRECT');
        setDirectCash(String(expectedCash));
    };

    // Gửi yêu cầu đóng ca
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (actualCashTotal < 0) {
            setError('Số tiền thực kiểm đếm không hợp lệ.');
            return;
        }

        // Tạo denomination payload nếu đếm theo mệnh giá
        let denominationsPayload = null;
        if (countMode === 'DENOMINATION') {
            denominationsPayload = DENOMINATIONS_LIST.map(d => ({
                denomination: d.value,
                count: counts[d.value] || 0,
                total: d.value * (counts[d.value] || 0)
            })).filter(item => item.count > 0);
        }

        setSubmitting(true);
        try {
            const res = await paymentService.closeShift(shift.id, {
                actual_cash: actualCashTotal,
                handover_user_id: handoverUserId ? Number(handoverUserId) : null,
                notes: notes.trim(),
                denominations: denominationsPayload
            });

            if (res.success) {
                if (onShiftClosed) {
                    onShiftClosed(res.shift);
                }
                onClose();
            } else {
                setError(res.message || 'Không thể đóng ca làm việc.');
            }
        } catch (err) {
            console.error('Lỗi khi đóng ca:', err);
            const msg = err.response?.data?.message || err.response?.data?.detail || 'Không thể đóng ca làm việc.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-3xl my-6 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header Modal */}
                <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-900">Kết Ca Làm Việc & Bàn Giao Quỹ</h3>
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                    #{shift.shift_code}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Bắt đầu: {formatTime(shift.opened_at)} • Trực ca: <span className="font-semibold text-slate-700">{shift.user_name || 'Thu ngân'}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Nội dung - Scrollable */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                    {/* Thông báo lỗi */}
                    {error && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* 1. KHỐI TÀI CHÍNH LÝ THUYẾT (HỆ THỐNG GHI NHẬN) */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Calculator className="w-4 h-4 text-blue-600" />
                                <span>1. Dòng Tiền Hệ Thống Ghi Nhận Trong Ca</span>
                            </h4>
                            {loadingSummary && (
                                <span className="text-[11px] text-blue-600 animate-pulse">Đang đối soát...</span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-400 block text-[11px]">Tiền đầu ca (A):</span>
                                <span className="font-bold text-slate-800 text-sm">
                                    {formatCurrency(openingCash)}
                                </span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-400 block text-[11px]">Tiền mặt thu (B):</span>
                                <span className="font-bold text-emerald-600 text-sm">
                                    +{formatCurrency(cashIn)}
                                </span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-400 block text-[11px]">Tiền mặt đã chi (C):</span>
                                <span className={`font-bold text-sm ${cashOut > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                                    {cashOut > 0 ? `-${formatCurrency(cashOut)}` : '0 đ'}
                                </span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-400 block text-[11px]">VietQR & Thẻ:</span>
                                <span className="font-bold text-blue-600 text-sm">
                                    {formatCurrency(transferIn + cardIn)}
                                </span>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3 rounded-xl border border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
                                <span className="text-emerald-800 font-semibold block text-[11px]">Két lý thuyết (A+B-C):</span>
                                <span className="font-black text-emerald-700 text-base">
                                    {formatCurrency(expectedCash)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2. KHỐI KIỂM ĐẾM TIỀN MẶT THỰC TẾ (CASH COUNT) */}
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Coins className="w-4 h-4 text-amber-600" />
                                <span>2. Kiểm Đếm Tiền Mặt Thực Tế Trong Két</span>
                            </label>

                            {/* Nút chuyển đổi chế độ & Điền nhanh */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleFillExpected}
                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                                >
                                    Khớp tiền lý thuyết
                                </button>
                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => setCountMode('DENOMINATION')}
                                        className={`px-2 py-0.5 rounded-md font-semibold transition ${
                                            countMode === 'DENOMINATION' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                                        }`}
                                    >
                                        Đếm từng mệnh giá
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCountMode('DIRECT')}
                                        className={`px-2 py-0.5 rounded-md font-semibold transition ${
                                            countMode === 'DIRECT' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                                        }`}
                                    >
                                        Nhập nhanh tổng tiền
                                    </button>
                                </div>
                            </div>
                        </div>

                        {countMode === 'DENOMINATION' ? (
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                                <div className="max-h-56 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-100 font-semibold">
                                            <tr>
                                                <th className="py-2 px-4 text-left">Mệnh giá tiền VNĐ</th>
                                                <th className="py-2 px-4 text-center w-28">Số tờ</th>
                                                <th className="py-2 px-4 text-right">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {DENOMINATIONS_LIST.map((d) => {
                                                const count = counts[d.value] || 0;
                                                const total = d.value * count;
                                                return (
                                                    <tr key={d.value} className="hover:bg-slate-50/50">
                                                        <td className="py-2 px-4 font-semibold text-slate-800">
                                                            {d.label}
                                                        </td>
                                                        <td className="py-2 px-4 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={count === 0 ? '' : count}
                                                                onChange={(e) => handleCountChange(d.value, e.target.value)}
                                                                placeholder="0"
                                                                className="w-20 text-center py-1 px-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-4 text-right font-mono font-bold text-slate-700">
                                                            {formatCurrency(total)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Banknote className="w-5 h-5 text-amber-600" />
                                </div>
                                <input
                                    type="text"
                                    value={directCash ? Number(directCash).toLocaleString('vi-VN') : ''}
                                    onChange={(e) => setDirectCash(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Nhập tổng số tiền thực tế trong két..."
                                    className="w-full pl-11 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                                    VNĐ
                                </div>
                            </div>
                        )}

                        {/* Tổng kết tiền thực tế & Chênh lệch thừa / thiếu */}
                        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-xs text-slate-500 block">Tổng tiền thực tế kiểm đếm:</span>
                                <span className="text-xl font-black text-slate-900">
                                    {formatCurrency(actualCashTotal)}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {difference === 0 ? (
                                    <div className="px-3.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        <span>Khớp quỹ chính xác 100% (0đ)</span>
                                    </div>
                                ) : difference > 0 ? (
                                    <div className="px-3.5 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                                        <span>Thừa quỹ: +{formatCurrency(difference)}</span>
                                    </div>
                                ) : (
                                    <div className="px-3.5 py-1.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                                        <AlertCircle className="w-4 h-4 text-rose-600" />
                                        <span>Thiếu hụt quỹ: {formatCurrency(difference)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. BÀN GIAO CHO NHÂN VIÊN TIẾP THEO & GHI CHÚ */}
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                3. Nhân Viên Nhận Bàn Giao Ca (Ca Tiếp Theo)
                            </label>
                            <div className="relative">
                                <select
                                    value={handoverUserId}
                                    onChange={(e) => setHandoverUserId(e.target.value)}
                                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                >
                                    <option value="">-- Không có người thay ca (Niêm phong / Nộp két) --</option>
                                    {staffList.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name || emp.username} ({emp.role_display || (emp.role === 'cashier' ? 'Thu ngân' : 'Lễ tân')}) - {emp.employee_code || emp.email || ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {staffList.length === 0 && (
                                <p className="text-[11px] text-slate-400 mt-1 italic">
                                    Không có nhân sự Thu ngân hoặc Lễ tân khác trực ca tiếp theo. Bạn có thể để trống nếu kết ca cuối ngày.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                4. Ghi Chú & Giải Trình Bàn Giao {difference !== 0 && <span className="text-rose-500 font-bold">* (Bắt buộc nếu lệch quỹ)</span>}
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Ghi chú về tiền thừa/thiếu, hóa đơn chứng từ kèm theo, máy POS, hoặc lưu ý bàn giao..."
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
                        >
                            Đóng lại
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold shadow-xs shadow-amber-600/30 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Đang kết ca & lập báo cáo...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Xác Nhận Kết Ca & Lập Phiếu Z-Report</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
