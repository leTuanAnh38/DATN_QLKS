import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardCheck, 
    X, 
    Search, 
    RotateCw, 
    Download, 
    Users, 
    Phone 
} from 'lucide-react';
import bookingService from '../../../../services/bookingService';

export default function StayingGuestsModal({ isOpen, onClose }) {
    const [guests, setGuests] = useState([]);
    const [totalRooms, setTotalRooms] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterIdType, setFilterIdType] = useState('all');

    const fetchGuests = async () => {
        setIsLoading(true);
        try {
            const res = await bookingService.getStayingGuests();
            if (res && res.success) {
                setGuests(res.data || []);
                setTotalRooms(res.total_rooms || 0);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách khách lưu trú:', error);
            alert('Không thể tải danh sách khách đang lưu trú. Vui lòng thử lại!');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchGuests();
        }
    }, [isOpen]);

    // Lọc theo tìm kiếm và loại giấy tờ
    const filteredGuests = useMemo(() => {
        return guests.filter((g) => {
            const matchesSearch =
                !searchTerm.trim() ||
                (g.full_name && g.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (g.id_number && g.id_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (g.room_number && String(g.room_number).toLowerCase().includes(searchTerm.toLowerCase())) ||
                (g.booking_code && g.booking_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (g.nationality && g.nationality.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesType =
                filterIdType === 'all' || g.id_type === filterIdType;

            return matchesSearch && matchesType;
        });
    }, [guests, searchTerm, filterIdType]);

    // XUẤT FILE CSV KÈM BOM \uFEFF ĐỂ EXCEL HIỂN THỊ CHUẨN TIẾNG VIỆT
    const exportToCSV = () => {
        if (!guests || guests.length === 0) {
            alert('Không có dữ liệu khách lưu trú để xuất file.');
            return;
        }

        const dataToExport = filteredGuests.length > 0 ? filteredGuests : guests;

        const headers = [
            'STT',
            'Số phòng',
            'Hạng phòng',
            'Mã đặt phòng',
            'Họ và tên',
            'Vai trò',
            'Loại giấy tờ',
            'Số định danh (CCCD/Passport)',
            'Ngày sinh',
            'Giới tính',
            'Quốc tịch',
            'Ngày giờ Check-in',
            'Dự kiến Check-out',
            'Số điện thoại'
        ];

        const rows = dataToExport.map((g, idx) => [
            idx + 1,
            `"${g.room_number || ''}"`,
            `"${(g.room_name || '').replace(/"/g, '""')}"`,
            `"${g.booking_code || ''}"`,
            `"${(g.full_name || '').replace(/"/g, '""')}"`,
            `"${g.is_primary ? 'Người đại diện' : 'Khách đi cùng'}"`,
            `"${g.id_type_display || g.id_type || ''}"`,
            `'${g.id_number || ''}`, // Dấu ' ở đầu để Excel giữ nguyên số 0 đầu và không chuyển sang dạng số khoa học
            `"${g.date_of_birth || ''}"`,
            `"${g.gender || ''}"`,
            `"${(g.nationality || 'Việt Nam').replace(/"/g, '""')}"`,
            `"${g.actual_check_in || g.check_in_date || ''}"`,
            `"${g.check_out_date || ''}"`,
            `"${g.guest_phone || ''}"`
        ]);

        // Thêm BOM \uFEFF ở đầu file để Microsoft Excel đọc đúng Encoding UTF-8
        const csvContent =
            '\uFEFF' +
            [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

        link.setAttribute('href', url);
        link.setAttribute('download', `DS_Khai_Bao_Luu_Tru_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-2.5 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 max-w-5xl w-full p-4 sm:p-6 shadow-2xl text-left max-h-[94vh] sm:max-h-[92vh] overflow-hidden flex flex-col justify-between animate-in zoom-in-95 duration-200">
                {/* 1. HEADER MODAL */}
                <div className="flex items-start justify-between pb-3.5 sm:pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                            <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider border border-emerald-300">
                                    Khai báo tạm trú
                                </span>
                                <span className="hidden sm:inline text-xs text-slate-300">•</span>
                                <span className="text-[11px] sm:text-xs font-bold text-slate-500">
                                    Khách thực tế đang lưu trú
                                </span>
                            </div>
                            <h3 className="text-base sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5 sm:mt-1 leading-tight">
                                Danh Sách Khai Báo Lưu Trú Khách Sạn
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer shrink-0"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 2. THANH THỐNG KÊ NHANH & BỘ LỌC */}
                <div className="py-3 sm:py-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div className="p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                                Tổng số khách
                            </span>
                            <strong className="text-base sm:text-lg font-black text-emerald-950 block mt-0.5">
                                {guests.length} khách
                            </strong>
                        </div>

                        <div className="p-2.5 sm:p-3 bg-blue-50/70 border border-blue-200 rounded-2xl">
                            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-blue-800 tracking-wider block">
                                Phòng có khách
                            </span>
                            <strong className="text-base sm:text-lg font-black text-blue-950 block mt-0.5">
                                {totalRooms} phòng
                            </strong>
                        </div>

                        <div className="col-span-2 sm:col-span-1 p-2.5 sm:p-3 bg-amber-50/70 border border-amber-200 rounded-2xl">
                            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
                                Thời điểm xuất báo cáo
                            </span>
                            <strong className="text-[11px] sm:text-xs font-bold text-amber-950 block mt-0.5 sm:mt-1 truncate">
                                {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date().toLocaleDateString('vi-VN')}
                            </strong>
                        </div>
                    </div>

                    {/* THANH TÌM KIẾM & NÚT XUẤT EXCEL */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                        <div className="flex flex-1 items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Tìm Tên, CCCD/Passport, P.101, Mã đơn..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <select
                                value={filterIdType}
                                onChange={(e) => setFilterIdType(e.target.value)}
                                className="px-2.5 sm:px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer max-w-[130px] sm:max-w-none"
                            >
                                <option value="all">Tất cả giấy tờ</option>
                                <option value="CCCD">CCCD / CMND</option>
                                <option value="PASSPORT">Hộ chiếu</option>
                                <option value="OTHER">Trẻ em / Khác</option>
                            </select>

                            <button
                                type="button"
                                onClick={fetchGuests}
                                disabled={isLoading}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer shrink-0"
                                title="Tải lại danh sách"
                            >
                                <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* NÚT XUẤT CSV / EXCEL */}
                        <button
                            type="button"
                            onClick={exportToCSV}
                            disabled={isLoading || guests.length === 0}
                            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span>Tải file Excel / CSV</span>
                        </button>
                    </div>
                </div>

                {/* 3. DANH SÁCH DỮ LIỆU KHÁCH LƯU TRÚ (DESKTOP TABLE + MOBILE CARDS) */}
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
                    {isLoading ? (
                        <div className="py-16 text-center">
                            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                            <span className="text-slate-500 text-xs font-medium">Đang tải danh sách khách lưu trú...</span>
                        </div>
                    ) : filteredGuests.length === 0 ? (
                        <div className="py-16 text-center px-4">
                            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <h4 className="text-sm font-bold text-slate-700">Không tìm thấy khách lưu trú phù hợp</h4>
                            <p className="text-xs text-slate-400 mt-1">
                                {guests.length === 0
                                    ? 'Hiện tại không có phòng nào ở trạng thái Check-in (Đang ở).'
                                    : 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* A. BẢNG DESKTOP / TABLET (>= md) */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                                        <tr>
                                            <th className="py-2.5 px-3 text-center w-10 whitespace-nowrap">STT</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap">Phòng</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap">Mã Đơn</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap min-w-[170px]">Họ và tên</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap min-w-[150px]">Giấy tờ & Số định danh</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap">Ngày sinh / Giới tính</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap text-center">Quốc tịch</th>
                                            <th className="py-2.5 px-3 whitespace-nowrap">Thời gian lưu trú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-800">
                                        {filteredGuests.map((g, idx) => (
                                            <tr
                                                key={g.id || idx}
                                                className={`hover:bg-slate-50/80 transition ${
                                                    g.is_primary ? 'bg-blue-50/20' : ''
                                                }`}
                                            >
                                                <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                                    {idx + 1}
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-900 font-black text-xs rounded-lg border border-emerald-300 inline-block font-mono">
                                                        {g.room_number || 'Chưa gán'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[130px]">
                                                        {g.room_name}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <span className="font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
                                                        #{g.booking_code}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 min-w-[170px]">
                                                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 whitespace-nowrap">
                                                        <span>{g.full_name}</span>
                                                        {g.is_primary && (
                                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded whitespace-nowrap shrink-0">
                                                                Đại diện
                                                            </span>
                                                        )}
                                                    </div>
                                                    {g.guest_phone && (
                                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                            {g.guest_phone}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 min-w-[150px] whitespace-nowrap">
                                                    <span className="text-[10px] font-bold text-slate-500 block uppercase">
                                                        {g.id_type_display || g.id_type || 'CCCD'}
                                                    </span>
                                                    <strong className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                                                        {g.id_number || <span className="text-slate-400 italic font-normal">Chưa có</span>}
                                                    </strong>
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <div>{g.date_of_birth || <span className="text-slate-400">—</span>}</div>
                                                    <span className="text-[10px] text-slate-500 block">
                                                        {g.gender || '—'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap text-center">
                                                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200 whitespace-nowrap shrink-0 inline-block">
                                                        {g.nationality || 'Việt Nam'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-[11px] whitespace-nowrap">
                                                    <div className="text-emerald-700 font-semibold">
                                                        Vào: {g.actual_check_in || g.check_in_date || '—'}
                                                    </div>
                                                    <div className="text-slate-500 text-[10px]">
                                                        Ra: {g.check_out_date || '—'}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* B. THẺ DANH SÁCH DI ĐỘNG (< md) */}
                            <div className="block md:hidden divide-y divide-slate-100">
                                {filteredGuests.map((g, idx) => (
                                    <div
                                        key={g.id || idx}
                                        className={`p-3.5 space-y-2.5 ${g.is_primary ? 'bg-blue-50/25' : 'bg-white'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                                                        <span>{g.full_name}</span>
                                                        {g.is_primary && (
                                                            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">
                                                                Đại diện
                                                            </span>
                                                        )}
                                                    </div>
                                                    {g.guest_phone && (
                                                        <a
                                                            href={`tel:${g.guest_phone}`}
                                                            className="text-[11px] text-blue-600 hover:underline font-mono flex items-center gap-1 mt-0.5"
                                                        >
                                                            <Phone className="w-3 h-3 text-blue-600 shrink-0" />
                                                            {g.guest_phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-black text-xs rounded-lg border border-emerald-300 font-mono inline-block">
                                                    {g.room_number ? `P.${g.room_number}` : 'Chưa gán'}
                                                </span>
                                                <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                                                    #{g.booking_code}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                                            <div>
                                                <span className="text-slate-400 text-[10px] block uppercase font-bold">
                                                    {g.id_type_display || g.id_type || 'CCCD'}
                                                </span>
                                                <span className="font-mono font-bold text-slate-900">
                                                    {g.id_number || 'Chưa có'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] block uppercase font-bold">
                                                    Quốc tịch
                                                </span>
                                                <span className="font-semibold text-slate-800">
                                                    {g.nationality || 'Việt Nam'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] block uppercase font-bold">
                                                    Ngày sinh / Giới tính
                                                </span>
                                                <span className="text-slate-800">
                                                    {g.date_of_birth || '—'} {g.gender ? `(${g.gender})` : ''}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] block uppercase font-bold">
                                                    Lưu trú
                                                </span>
                                                <span className="text-emerald-700 font-bold">
                                                    {g.check_out_date ? `Ra: ${g.check_out_date}` : 'Đang ở'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* 4. FOOTER MODAL */}
                <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500 text-center sm:text-left">
                        Hiển thị <strong>{filteredGuests.length}</strong> / <strong>{guests.length}</strong> khách lưu trú thực tế.
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                        >
                            Đóng
                        </button>

                        <button
                            type="button"
                            onClick={exportToCSV}
                            disabled={isLoading || guests.length === 0}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span>Xuất Excel / CSV</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
