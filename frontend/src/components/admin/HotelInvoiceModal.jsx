import React from 'react';

/**
 * Component Modal & Mẫu In Hóa Đơn Đặt Phòng (Check-in Invoice Voucher)
 * Thiết kế chuẩn phom Hóa đơn / Phiếu xác nhận nhận phòng Khách sạn:
 * - Tông màu trắng đen / monochrome trang nhã, sắc nét cho in ấn giấy A4
 * - KHÔNG có icon emoji, KHÔNG có chữ màu mè hay badge gradient
 * - Tương thích lệnh in trình duyệt window.print() (chỉ in nội dung hóa đơn, ẩn hoàn toàn giao diện xung quanh)
 */
export default function HotelInvoiceModal({ booking, onClose }) {
    if (!booking) return null;

    // Helper format ngày DD/MM/YYYY
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

    // Helper format ngày giờ DD/MM/YYYY HH:mm
    const formatDateTime = (isoStr) => {
        if (!isoStr) {
            const now = new Date();
            const time = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
            const date = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${date} ${time}`;
        }
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
            const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${date} ${time}`;
        } catch {
            return isoStr;
        }
    };

    // Helper format tiền tệ VNĐ: e.g. 1,440,000đ
    const formatCurrency = (amount) => {
        const num = Number(amount) || 0;
        return `${num.toLocaleString('vi-VN')}đ`;
    };

    // Trích xuất phương thức thanh toán từ note (nếu có)
    const getPaymentMethod = () => {
        if (booking.note && booking.note.includes('Thanh toán:')) {
            const method = booking.note.split('Thanh toán:')[1].trim().split('|')[0].trim();
            if (method) return method;
        }
        return 'Chuyển khoản ngân hàng / Tiền mặt';
    };

    // Trích xuất yêu cầu đặc biệt từ note
    const getSpecialRequest = () => {
        if (!booking.note) return 'Không có yêu cầu đặc biệt';
        const cleaned = booking.note.replace(/Thanh toán:[^|]+(\|)?/gi, '').trim();
        return cleaned || 'Không có yêu cầu đặc biệt';
    };

    const nights = Math.max(1, Number(booking.nights) || 1);
    const roomAmount = Number(booking.room_amount || booking.total_amount) || 0;
    
    // Đơn giá phòng theo đêm:
    // Nếu có daily_rate từ backend thì dùng, ngược lại tính tạm từ roomAmount / nights
    let pricePerNight = Number(booking.daily_rate) || 0;
    if (!pricePerNight || pricePerNight <= 0) {
        pricePerNight = Math.round(roomAmount / nights);
    }

    const roomSubtotal = pricePerNight * nights;
    const discountAmount = Math.max(0, roomSubtotal - roomAmount);

    // Phụ phí dịch vụ phát sinh tại phòng (In-Room Dining / Services)
    const extraServices = Array.isArray(booking.extra_services) ? booking.extra_services : [];
    const extraServicesTotal = Number(booking.extra_services_total) || 
        extraServices.reduce((sum, s) => sum + (Number(s.price || 0) * Number(s.quantity || 1)), 0);

    // Tổng thanh toán thực tế (Grand Total bao gồm cả tiền phòng và toàn bộ dịch vụ phát sinh)
    const grandTotal = Number(booking.grand_total_amount) || (roomAmount + extraServicesTotal);
    const bookingCodeDisplay = `#${String(booking.booking_code || '').replace('-', '')}`;
    const printDate = formatDateTime(booking.actual_check_in || booking.created_at || new Date().toISOString());

    // Lắng nghe phím Escape để đóng nhanh modal
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Kích hoạt lệnh in trình duyệt
    const handlePrint = () => {
        window.print();
    };

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-start justify-center p-2 sm:p-4 backdrop-blur-xs"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Scoped CSS cho chế độ in A4: Ẩn tất cả body, chỉ hiển thị duy nhất #hotel-invoice-printable */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 15mm 15mm 15mm 15mm;
                    }
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #hotel-invoice-printable,
                    #hotel-invoice-printable * {
                        visibility: visible !important;
                    }
                    #hotel-invoice-printable {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6">
                {/* THANH ĐIỀU KHIỂN (Ẩn khi in) - Sticky top */}
                <div className="no-print sticky top-0 z-20 bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-xs">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-wide">
                            Xem Trước Hóa Đơn Đặt Phòng
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                            ({bookingCodeDisplay})
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span>In hóa đơn (Ctrl + P)</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>

                {/* VÙNG NỘI DUNG HÓA ĐƠN IN ẤN (CHUẨN FORM ẢNH MẪU - ĐEN TRẮNG, KHÔNG ICON, KHÔNG CHỮ MÀU) */}
                <div
                    id="hotel-invoice-printable"
                    className="p-8 sm:p-10 bg-white text-slate-900 font-sans"
                    style={{ minHeight: '680px', color: '#111827' }}
                >
                    {/* 1. HEADER: THÔNG TIN KHÁCH SẠN VÀ TIÊU ĐỀ HÓA ĐƠN */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4">
                        {/* Cột trái: Tên khách sạn & địa chỉ chính thức của Khách Sạn TA Đà Nẵng */}
                        <div className="flex items-start gap-3.5">
                            {/* Logo thương hiệu TA: Monogram hộp vuông bo góc chuẩn nhận diện thương hiệu */}
                            <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center font-serif font-black text-xl shadow-xs border border-slate-900 tracking-tighter">
                                TA
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 leading-tight uppercase font-serif tracking-wide">
                                    Khách Sạn TA Đà Nẵng
                                </h1>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-0.5">
                                    5-Star Luxury Resort & Hotel
                                </p>
                                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                    08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng
                                </p>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    Hotline: 1900 8899 | Email: contact@tahotel.vn
                                </p>
                            </div>
                        </div>

                        {/* Cột phải: Tiêu đề Hóa Đơn & Mã đơn */}
                        <div className="text-left sm:text-right">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase">
                                HÓA ĐƠN ĐẶT PHÒNG
                            </h2>
                            <p className="text-xs text-slate-700 mt-1.5 font-medium">
                                Mã đặt phòng: <strong className="font-bold text-slate-900">{bookingCodeDisplay}</strong>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Ngày lập: {printDate}
                            </p>
                        </div>
                    </div>

                    {/* Đường phân cách mảnh */}
                    <div className="border-t border-slate-200 my-4" />

                    {/* 2. KHỐI THÔNG TIN: THÔNG TIN KHÁCH HÀNG & THÔNG TIN ĐẶT PHÒNG (2 CỘT) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs py-2">
                        {/* 2.1 CỘT TRÁI: THÔNG TIN KHÁCH HÀNG */}
                        <div>
                            <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-1.5 border-b border-slate-200 mb-3">
                                THÔNG TIN KHÁCH HÀNG:
                            </h3>
                            <div className="space-y-2 text-slate-700">
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Họ tên khách:</span>
                                    <strong className="text-slate-900 font-bold">{booking.guest_name || 'Khách vãng lai'}</strong>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Số điện thoại:</span>
                                    <span className="text-slate-900 font-medium">{booking.guest_phone || '—'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Email:</span>
                                    <span className="text-slate-900 font-medium">{booking.guest_email || '—'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">CCCD / Hộ chiếu:</span>
                                    <span className="text-slate-900 font-medium">{booking.identity_card || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 2.2 CỘT PHẢI: THÔNG TIN ĐẶT PHÒNG */}
                        <div>
                            <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-1.5 border-b border-slate-200 mb-3">
                                THÔNG TIN ĐẶT PHÒNG:
                            </h3>
                            <div className="space-y-2 text-slate-700">
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Mã đặt phòng:</span>
                                    <strong className="text-slate-900 font-bold">{bookingCodeDisplay}</strong>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Phòng lưu trú:</span>
                                    <strong className="text-slate-900 font-bold">
                                        {booking.room_number ? `Phòng ${booking.room_number}` : 'Chưa xếp số'} ({booking.room_name || 'Tiêu chuẩn'})
                                    </strong>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Thời gian lưu trú:</span>
                                    <span className="text-slate-900 font-medium">
                                        {formatDate(booking.check_in_date)} đến {formatDate(booking.check_out_date)} ({nights} đêm)
                                    </span>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Phương thức:</span>
                                    <span className="text-slate-900 font-medium">{getPaymentMethod()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. BẢNG CHI TIẾT THANH TOÁN PHÒNG NGHỈ */}
                    <div className="mt-6">
                        <h4 className="font-bold text-xs text-slate-900 mb-2">
                            Chi tiết thanh toán phòng nghỉ:
                        </h4>

                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-300 text-slate-700">
                                        <th className="py-2.5 text-left font-bold uppercase text-[11px] tracking-wider w-1/2">
                                            NỘI DUNG THANH TOÁN
                                        </th>
                                        <th className="py-2.5 text-right font-bold uppercase text-[11px] tracking-wider">
                                            ĐƠN GIÁ
                                        </th>
                                        <th className="py-2.5 text-center font-bold uppercase text-[11px] tracking-wider">
                                            SỐ LƯỢNG
                                        </th>
                                        <th className="py-2.5 text-right font-bold uppercase text-[11px] tracking-wider">
                                            THÀNH TIỀN
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-200">
                                        <td className="py-3 text-left">
                                            <div className="font-bold text-slate-900 text-xs">
                                                Tiền phòng nghỉ - Room Charge
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">
                                                {booking.room_number ? `Phòng ${booking.room_number}` : booking.room_name} ({nights} đêm x {formatCurrency(pricePerNight)})
                                            </div>
                                        </td>
                                        <td className="py-3 text-right text-slate-800 font-medium">
                                            {formatCurrency(pricePerNight)}
                                        </td>
                                        <td className="py-3 text-center text-slate-800 font-medium">
                                            {nights} đêm
                                        </td>
                                        <td className="py-3 text-right font-bold text-slate-900">
                                            {formatCurrency(roomSubtotal)}
                                        </td>
                                    </tr>

                                    {/* CÁC DÒNG DỊCH VỤ PHÁT SINH / GỌI MÓN TẠI PHÒNG */}
                                    {extraServices.map((service, idx) => {
                                        const cleanName = (service.service_name || '')
                                            .replace(/\[Yêu cầu #\d+\]/gi, '')
                                            .replace(/\(x\d+\)/gi, '')
                                            .trim();
                                        return (
                                            <tr key={service.id || idx} className="border-b border-slate-200">
                                                <td className="py-2.5 text-left">
                                                    <div className="font-bold text-slate-900 text-xs">
                                                        {cleanName}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        Dịch vụ phát sinh / Gọi món tại phòng
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right text-slate-800 font-medium">
                                                    {formatCurrency(service.price)}
                                                </td>
                                                <td className="py-2.5 text-center text-slate-800 font-medium">
                                                    {service.quantity}
                                                </td>
                                                <td className="py-2.5 text-right font-bold text-slate-900">
                                                    {formatCurrency(service.total_price || (service.price * service.quantity))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 4. KHỐI TỔNG KẾT TIỀN & YÊU CẦU ĐẶC BIỆT */}
                    <div className="mt-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                        {/* Cột trái: Yêu cầu đặc biệt của khách */}
                        <div className="pt-2 text-slate-600">
                            <span className="font-bold text-slate-900 italic">Yêu cầu đặc biệt: </span>
                            <span className="italic">"{getSpecialRequest()}"</span>
                        </div>

                        {/* Cột phải: Các dòng cộng tiền, khấu trừ giảm giá, tạm tính, tổng cộng */}
                        <div className="space-y-2 text-right">
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                <span className="text-slate-500">Cộng tiền phòng:</span>
                                <span className="font-medium text-slate-900 w-28 text-right">
                                    {formatCurrency(roomSubtotal)}
                                </span>
                            </div>

                            {discountAmount > 0 && (
                                <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                    <span className="text-slate-500">
                                        Khấu trừ giảm giá ({booking.promotion_code || 'ƯU ĐÃI'}):
                                    </span>
                                    <span className="font-medium text-slate-900 w-28 text-right">
                                        -{formatCurrency(discountAmount)}
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                <span className="text-slate-500">Tiền phòng sau ưu đãi:</span>
                                <span className="font-medium text-slate-900 w-28 text-right">
                                    {formatCurrency(roomAmount)}
                                </span>
                            </div>

                            {extraServicesTotal > 0 && (
                                <div className="flex justify-between sm:justify-end gap-6 text-slate-700 font-semibold">
                                    <span>
                                        Dịch vụ phát sinh ({extraServices.length} món):
                                    </span>
                                    <span className="w-28 text-right text-slate-900">
                                        +{formatCurrency(extraServicesTotal)}
                                    </span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-slate-300 flex justify-between sm:justify-end items-baseline gap-6">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 uppercase">
                                    Tổng thanh toán (Grand Total):
                                </span>
                                <span className="font-bold text-base sm:text-lg text-slate-900 w-36 text-right">
                                    {formatCurrency(grandTotal)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 5. KHỐI CHỮ KÝ: KHÁCH HÀNG KÝ NHẬN & ĐẠI DIỆN KHÁCH SẠN */}
                    <div className="mt-14 pt-4 grid grid-cols-2 gap-8 text-center text-xs">
                        <div>
                            <p className="font-bold text-slate-900">
                                Khách hàng ký nhận
                            </p>
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                                (Ký, ghi rõ họ tên)
                            </p>
                            <div className="h-20 sm:h-24"></div>
                            <p className="font-semibold text-slate-800 text-xs">
                                {booking.guest_name || ''}
                            </p>
                        </div>

                        <div>
                            <p className="font-bold text-slate-900">
                                Đại diện khách sạn
                            </p>
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                                (Ký, ghi rõ họ tên)
                            </p>
                            <div className="h-20 sm:h-24"></div>
                            <p className="font-semibold text-slate-800 text-xs">
                                Lễ tân Khách Sạn TA Đà Nẵng
                            </p>
                        </div>
                    </div>
                </div>

                {/* FOOTER NÚT THAO TÁC Ở ĐÁY MODAL (Ẩn khi in) */}
                <div className="no-print bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div>
                        <span>💡 Lưu ý: Trình duyệt hỗ trợ chọn <strong>"Save as PDF"</strong> (Lưu thành tệp PDF) hoặc in ra máy in A4 tiêu chuẩn.</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition cursor-pointer"
                        >
                            Đóng cửa sổ
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span>In hóa đơn ngay</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
