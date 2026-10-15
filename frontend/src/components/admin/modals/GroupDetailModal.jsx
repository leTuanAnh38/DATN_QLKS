import React, { useState } from 'react';
import { bookingService } from '../../../services/bookingService';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

export default function GroupDetailModal({ group, isOpen, onClose, onRefresh }) {
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState(null);

    if (!isOpen || !group) return null;

    // Check-in All Rooms
    const handleCheckInAll = async () => {
        if (!window.confirm(`Xác nhận Check-in đồng loạt cho toàn bộ các phòng thuộc đoàn #${group.group_code}?`)) return;
        try {
            setIsActionLoading(true);
            const res = await bookingService.groupCheckIn(group.id);
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message });
                if (typeof onRefresh === 'function') onRefresh();
            } else {
                setActionMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Check-out All Rooms
    const handleCheckOutAll = async () => {
        if (!window.confirm(`Xác nhận Check-out đồng loạt cho đoàn #${group.group_code} và chuyển phòng sang dọn dẹp?`)) return;
        try {
            setIsActionLoading(true);
            const res = await bookingService.groupCheckOut(group.id, { mark_invoice_paid: true });
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message });
                if (typeof onRefresh === 'function') onRefresh();
            } else {
                setActionMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Confirm Deposit
    const handleConfirmDeposit = async () => {
        try {
            setIsActionLoading(true);
            const res = await bookingService.confirmGroupDeposit(group.id);
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message });
                if (typeof onRefresh === 'function') onRefresh();
            } else {
                setActionMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi khi xác nhận tiền cọc.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const subBookings = group.sub_bookings || [];

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full p-6 sm:p-8 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col justify-between">
                
                <div>
                    {/* MODAL HEADER */}
                    <div className="flex items-start justify-between pb-4 border-b border-slate-200 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 shrink-0">
                                🏢
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                                        #{group.group_code}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-blue-100 text-blue-800">
                                        {group.status_display || group.status}
                                    </span>
                                    {group.corporate_partner_details && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                            🏢 {group.corporate_partner_details.company_name} (-{group.corporate_partner_details.discount_percent}%)
                                        </span>
                                    )}
                                </div>
                                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                                    {group.group_name}
                                </h2>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-base cursor-pointer shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    {/* ACTION MESSAGE */}
                    {actionMessage && (
                        <div className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                            actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                            <span>{actionMessage.type === 'success' ? '✓' : '⚠️'}</span>
                            <span>{actionMessage.text}</span>
                        </div>
                    )}

                    {/* OVERVIEW STATS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Quy mô đoàn</span>
                            <div className="text-base font-black text-slate-900 mt-0.5">{group.total_rooms || subBookings.length} phòng</div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Lưu trú</span>
                            <div className="text-xs font-bold text-slate-900 mt-0.5">
                                {formatDate(group.check_in_date)} - {formatDate(group.check_out_date)} ({group.nights} đêm)
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng tiền hợp đồng</span>
                            <div className="text-base font-black text-indigo-700 mt-0.5">{formatCurrency(group.total_amount)}</div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Đặt cọc</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-bold text-slate-900">{formatCurrency(group.deposit_amount)}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    group.is_deposit_paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {group.is_deposit_paid ? 'Đã cọc' : 'Chờ cọc'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* LEADER INFO */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                👤
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Người đại diện / Trưởng đoàn</span>
                                <strong className="text-slate-900">{group.leader_name}</strong>
                                <span className="text-slate-500 ml-2">📞 {group.leader_phone}</span>
                                {group.leader_email && <span className="text-slate-500 ml-2">✉️ {group.leader_email}</span>}
                            </div>
                        </div>

                        {!group.is_deposit_paid && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleConfirmDeposit}
                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                            >
                                💰 Xác nhận đã nhận tiền cọc
                            </button>
                        )}
                    </div>

                    {/* DANH SÁCH CÁC PHÒNG CON (SUB-BOOKINGS) & ROOMING LIST */}
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span>🛏️</span>
                                <span>Danh Sách Phòng Lưu Trú Thuộc Đoàn ({subBookings.length} phòng)</span>
                            </h3>
                        </div>

                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                            {subBookings.map((b, idx) => (
                                <div key={b.id || idx} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="font-mono text-xs font-bold text-slate-400 w-6">#{idx + 1}</span>
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col items-center justify-center shrink-0">
                                            <span className="text-[9px] uppercase font-bold text-indigo-500">Phòng</span>
                                            <span className="text-xs font-black text-indigo-800">{b.room_number || '—'}</span>
                                        </div>
                                        <div className="truncate">
                                            <div className="font-bold text-slate-900 text-xs truncate">{b.room_name || 'Phòng tiêu chuẩn'}</div>
                                            <span className="text-[11px] text-slate-500">
                                                Khách đại diện: <strong>{b.guest_name || group.leader_name}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-xs font-bold text-slate-700">{formatCurrency(b.total_amount)}</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            b.status === 'checked_in'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : b.status === 'checked_out'
                                                ? 'bg-slate-100 text-slate-600'
                                                : 'bg-blue-100 text-blue-800'
                                        }`}>
                                            {b.status_display || b.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MODAL FOOTER & BULK ACTIONS */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {group.status !== 'checked_in' && group.status !== 'checked_out' && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleCheckInAll}
                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                <span>🔑</span>
                                <span>Check-in Toàn Đoàn (1 chạm)</span>
                            </button>
                        )}

                        {group.status === 'checked_in' && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleCheckOutAll}
                                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                <span>🧾</span>
                                <span>Check-out Toàn Đoàn & Quyết Toán</span>
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                    >
                        Đóng Cửa Sổ
                    </button>
                </div>

            </div>
        </div>
    );
}
