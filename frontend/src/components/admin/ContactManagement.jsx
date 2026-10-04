import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Mail, MailOpen, Trash2, Eye, Check, X, Inbox, AlertTriangle } from 'lucide-react';
import { contactService } from '../../services/contactService';
import Pagination from '../common/Pagination';

const PAGE_SIZE = 10;

// Giờ:Phút và Ngày/Tháng/Năm tách riêng để hiển thị 2 dòng
const formatTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
};
const formatDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function StatusBadge({ isRead }) {
    return isRead ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold whitespace-nowrap">
            <MailOpen className="w-3.5 h-3.5" />
            Đã đọc
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-600 text-[11px] font-semibold whitespace-nowrap">
            <Mail className="w-3.5 h-3.5" />
            Chưa đọc
        </span>
    );
}

export default function ContactManagement() {
    const [contacts, setContacts] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // Giá trị đang nhập ở bộ lọc (chưa áp dụng) và giá trị đã áp dụng khi bấm "Lọc"
    const [searchInput, setSearchInput] = useState('');
    const [statusInput, setStatusInput] = useState('');
    const [appliedFilters, setAppliedFilters] = useState({ search: '', is_read: '' });

    // Modal xem chi tiết & xác nhận xóa
    const [selectedContact, setSelectedContact] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [markingId, setMarkingId] = useState(null);

    // Toast
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);
    const showToast = (type, text) => {
        setToast({ type, text });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    };
    useEffect(() => () => clearTimeout(toastTimer.current), []);

    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        const res = await contactService.getContacts({
            page: currentPage,
            page_size: PAGE_SIZE,
            search: appliedFilters.search,
            is_read: appliedFilters.is_read,
        });
        if (res.success) {
            setContacts(res.results);
            setTotalCount(res.count);
            setTotalPages(res.total_pages);
            // Trang hiện tại vượt quá tổng số trang (vd: vừa xóa hết bản ghi trang cuối)
            if (res.total_pages > 0 && currentPage > res.total_pages) {
                setCurrentPage(res.total_pages);
            }
        } else {
            showToast('error', res.message || 'Không thể tải danh sách liên hệ.');
        }
        setIsLoading(false);
    }, [currentPage, appliedFilters]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        setAppliedFilters({ search: searchInput.trim(), is_read: statusInput });
    };

    // Cập nhật 1 bản ghi ngay trên bảng sau khi đánh dấu đã đọc
    const applyReadLocally = (id) => {
        setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, is_read: true } : c)));
        setSelectedContact((prev) => (prev && prev.id === id ? { ...prev, is_read: true } : prev));
    };

    const handleMarkRead = async (contact) => {
        setMarkingId(contact.id);
        const res = await contactService.markAsRead(contact.id);
        setMarkingId(null);
        if (res.success) {
            // Đang lọc "Chưa đọc" thì tải lại để bản ghi biến mất khỏi danh sách
            if (appliedFilters.is_read === 'false') fetchContacts();
            else applyReadLocally(contact.id);
            showToast('success', 'Đã đánh dấu liên hệ là đã đọc.');
        } else {
            showToast('error', res.message);
        }
    };

    // Mở modal: hiển thị ngay, đồng thời tự gọi API đánh dấu đã đọc
    const handleView = async (contact) => {
        setSelectedContact(contact);
        if (!contact.is_read) {
            const res = await contactService.markAsRead(contact.id);
            if (res.success) applyReadLocally(contact.id);
            else showToast('error', res.message);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        const res = await contactService.deleteContact(deleteTarget.id);
        setIsDeleting(false);
        if (res.success) {
            showToast('success', 'Đã xóa liên hệ thành công.');
            setDeleteTarget(null);
            // Xóa bản ghi cuối của trang > 1 thì lùi về trang trước
            if (contacts.length === 1 && currentPage > 1) setCurrentPage(currentPage - 1);
            else fetchContacts();
        } else {
            showToast('error', res.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-fadeIn ${
                        toast.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                >
                    {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Tiêu đề trang */}
            <div>
                <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">Quản Lý Liên Hệ</h2>
                <p className="text-xs text-slate-500 mt-1">Tiếp nhận và xử lý các yêu cầu liên hệ từ khách hàng.</p>
            </div>

            {/* Khối bộ lọc */}
            <form
                onSubmit={handleFilterSubmit}
                className="flex flex-col md:flex-row md:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"
            >
                <div className="relative md:w-[40%]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Tên, email, chủ đề, nội dung..."
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                </div>
                <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    className="md:w-52 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                    <option value="">-- Tất cả --</option>
                    <option value="false">Chưa đọc</option>
                    <option value="true">Đã đọc</option>
                </select>
                <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition cursor-pointer shadow-sm"
                >
                    Lọc
                </button>
            </form>

            {/* Bảng dữ liệu */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900">
                        Danh sách yêu cầu liên hệ ({totalCount} bản ghi)
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-3.5">Khách hàng</th>
                                <th className="px-4 py-3.5">Chủ đề</th>
                                <th className="px-4 py-3.5">Nội dung tóm tắt</th>
                                <th className="px-4 py-3.5">Ngày gửi</th>
                                <th className="px-4 py-3.5">Trạng thái</th>
                                <th className="px-6 py-3.5">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="inline-flex items-center gap-3 text-slate-400 text-xs font-medium">
                                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            Đang tải danh sách liên hệ...
                                        </div>
                                    </td>
                                </tr>
                            ) : contacts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500 font-medium">Không có yêu cầu liên hệ nào.</p>
                                    </td>
                                </tr>
                            ) : (
                                contacts.map((c) => (
                                    <tr key={c.id} className="hover:bg-blue-50/30 transition">
                                        <td className="px-6 py-4">
                                            <div className={`text-slate-900 ${c.is_read ? 'font-semibold' : 'font-bold'}`}>{c.name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{c.email}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-blue-600 font-medium">{c.subject}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="truncate max-w-xs text-slate-600" title={c.message}>
                                                {c.message}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="text-slate-900 font-semibold text-xs">{formatTime(c.created_at)}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{formatDate(c.created_at)}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <StatusBadge isRead={c.is_read} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleView(c)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Xem
                                                </button>
                                                {!c.is_read && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkRead(c)}
                                                        disabled={markingId === c.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        Đã đọc
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(c)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Xóa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!isLoading && totalCount > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>

            {/* Modal xem chi tiết */}
            {selectedContact && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setSelectedContact(null)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
                            <div className="min-w-0">
                                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Chi tiết liên hệ</span>
                                <h3 className="text-lg font-serif font-bold text-slate-900 mt-0.5 break-words">
                                    {selectedContact.subject}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedContact(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                                aria-label="Đóng"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Khách hàng</div>
                                    <div className="font-bold text-slate-900 mt-0.5">{selectedContact.name}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Email</div>
                                    <a href={`mailto:${selectedContact.email}`} className="text-blue-600 hover:underline mt-0.5 inline-block break-all">
                                        {selectedContact.email}
                                    </a>
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Ngày gửi</div>
                                    <div className="text-slate-800 mt-0.5">
                                        {formatTime(selectedContact.created_at)} • {formatDate(selectedContact.created_at)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">Trạng thái</div>
                                    <StatusBadge isRead={selectedContact.is_read} />
                                </div>
                            </div>

                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">Nội dung</div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                    {selectedContact.message}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/60">
                            <button
                                type="button"
                                onClick={() => setSelectedContact(null)}
                                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                            >
                                Đóng
                            </button>
                            <a
                                href={`mailto:${selectedContact.email}?subject=${encodeURIComponent('Re: ' + selectedContact.subject)}`}
                                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                            >
                                Phản hồi qua email
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal xác nhận xóa */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
                    onClick={() => !isDeleting && setDeleteTarget(null)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-3">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">Xóa liên hệ này?</h3>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                            Liên hệ của <strong className="text-slate-800">{deleteTarget.name}</strong> sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </p>
                        <div className="flex gap-2 mt-5">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-60"
                            >
                                {isDeleting ? 'Đang xóa...' : 'Xóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
