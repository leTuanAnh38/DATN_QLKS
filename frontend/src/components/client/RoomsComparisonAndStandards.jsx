import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Maximize2,
    Users,
    BedDouble,
    Banknote,
    CheckCircle2,
    Wifi,
    Tv,
    Wind,
    Bath,
    Coffee,
    Sparkles,
    Compass,
    Lock,
    Waves,
    UtensilsCrossed,
    ArrowRight
} from 'lucide-react';

// Chọn icon phù hợp theo tên tiện nghi thực tế trong DB
const getAmenityIcon = (name = '') => {
    const text = name.toLowerCase();
    if (text.includes('wifi') || text.includes('internet') || text.includes('mạng')) return Wifi;
    if (text.includes('tv') || text.includes('tivi') || text.includes('màn hình')) return Tv;
    if (text.includes('điều hòa') || text.includes('máy lạnh')) return Wind;
    if (text.includes('tắm') || text.includes('jacuzzi') || text.includes('bồn') || text.includes('spa')) return Bath;
    if (text.includes('cà phê') || text.includes('trà') || text.includes('minibar') || text.includes('bar')) return Coffee;
    if (text.includes('ban công') || text.includes('biển') || text.includes('view')) return Compass;
    if (text.includes('két') || text.includes('an toàn') || text.includes('khóa')) return Lock;
    if (text.includes('hồ bơi') || text.includes('bể bơi')) return Waves;
    if (text.includes('sáng') || text.includes('ăn') || text.includes('bếp')) return UtensilsCrossed;
    return Sparkles;
};

// Trích xuất danh sách tên tiện nghi thật từ 1 hạng phòng
const extractRoomAmenityNames = (room) => {
    if (!room || !Array.isArray(room.amenities)) return [];
    return room.amenities
        .map((a) => (typeof a === 'string' ? a : a?.name))
        .filter(Boolean)
        .map((s) => s.trim());
};

export default function RoomsComparisonAndStandards({
    categories = [],
    settings = {},
    effectiveCheckIn = '',
    effectiveCheckOut = '',
    effectiveGuests = '2'
}) {
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';

    // Chọn 3 hạng phòng đại diện thực tế từ DB (Thấp nhất -> Tầm trung -> Cao cấp nhất)
    const comparedRooms = useMemo(() => {
        if (!Array.isArray(categories) || categories.length === 0) return [];
        const sorted = [...categories].sort(
            (a, b) => Number(a.base_price || 0) - Number(b.base_price || 0)
        );
        if (sorted.length <= 3) return sorted;
        const midIdx = Math.floor(sorted.length / 2);
        return [sorted[0], sorted[midIdx], sorted[sorted.length - 1]];
    }, [categories]);

    // Tự động chọn tối đa 5 tiện nghi thực tế từ 3 hạng phòng để so sánh (ưu tiên tiện nghi tạo sự khác biệt giữa các hạng)
    const comparedAmenityNames = useMemo(() => {
        if (comparedRooms.length === 0) return [];
        const countMap = new Map();
        comparedRooms.forEach((room) => {
            const names = new Set(extractRoomAmenityNames(room));
            names.forEach((n) => {
                countMap.set(n, (countMap.get(n) || 0) + 1);
            });
        });

        return Array.from(countMap.entries())
            .sort((a, b) => {
                const aDiff = a[1] < comparedRooms.length ? 0 : 1;
                const bDiff = b[1] < comparedRooms.length ? 0 : 1;
                if (aDiff !== bDiff) return aDiff - bDiff;
                return b[1] - a[1];
            })
            .slice(0, 5)
            .map(([name]) => name);
    }, [comparedRooms]);

    if (comparedRooms.length < 2) {
        return null;
    }

    return (
        <section className="py-10 sm:py-20 bg-[#f4f7fc] border-t border-slate-200/70 w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-12">
                    <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-2 sm:mb-2.5">
                        MINH BẠCH &amp; RÕ RÀNG
                    </span>
                    <h2 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                        Bảng So Sánh Các Hạng Phòng
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-2 sm:mt-2.5 leading-relaxed">
                        Đối chiếu trực tiếp diện tích, sức chứa, mức giá và các tiện nghi thực tế giữa các phân khúc phòng nghỉ tại {hotelName}.
                    </p>
                </div>

                {/* Table Card */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_12px_35px_-15px_rgba(15,23,42,0.08)] overflow-hidden">
                    <div className="sm:hidden px-4 py-2 bg-sky-50/70 border-b border-slate-100 text-[11px] font-semibold text-sky-800 flex items-center justify-between">
                        <span>Vuốt ngang để xem đầy đủ 3 hạng phòng</span>
                        <ArrowRight className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] sm:min-w-[680px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200/80">
                                    <th className="sticky left-0 z-10 py-3 sm:py-5 px-2.5 sm:px-6 text-[11px] sm:text-sm font-bold text-slate-900 bg-slate-50 w-[118px] min-w-[118px] sm:w-[28%] shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)]">
                                        Thông Số &amp; Tiện Nghi
                                    </th>
                                    {comparedRooms.map((room, idx) => {
                                        const isMiddle = comparedRooms.length === 3 && idx === 1;
                                        const isTop = comparedRooms.length >= 2 && idx === comparedRooms.length - 1;
                                        return (
                                            <th
                                                key={room.id}
                                                className={`py-3 px-3 sm:py-5 sm:px-5 text-center text-xs sm:text-sm font-bold ${
                                                    isMiddle
                                                        ? 'bg-sky-50/80 text-blue-700'
                                                        : isTop
                                                            ? 'bg-slate-50/40 text-amber-800'
                                                            : 'bg-slate-50/40 text-slate-900'
                                                }`}
                                            >
                                                <span className="line-clamp-2">{room.name}</span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 text-[11.5px] sm:text-[13px]">
                                {/* Dòng 1: Giá mỗi đêm */}
                                <tr>
                                    <td className="sticky left-0 z-10 bg-white py-2.5 sm:py-4 px-2.5 sm:px-6 font-semibold text-slate-800 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)]">
                                        <span className="inline-flex items-center gap-1.5 sm:gap-2.5">
                                            <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 shrink-0" />
                                            <span>Giá phòng / đêm</span>
                                        </span>
                                    </td>
                                    {comparedRooms.map((room, idx) => {
                                        const isMiddle = comparedRooms.length === 3 && idx === 1;
                                        const hasPromo =
                                            room.promo_price &&
                                            Number(room.promo_price) > 0 &&
                                            Number(room.promo_price) < Number(room.base_price);
                                        const priceVal = hasPromo ? room.promo_price : room.base_price;
                                        return (
                                            <td
                                                key={room.id}
                                                className={`py-2.5 px-3 sm:py-4 sm:px-5 text-center tabular-nums ${
                                                    isMiddle ? 'bg-sky-50/45' : ''
                                                }`}
                                            >
                                                {hasPromo && (
                                                    <span className="block text-[10px] sm:text-[10.5px] line-through text-slate-400">
                                                        {Number(room.base_price).toLocaleString('vi-VN')} đ
                                                    </span>
                                                )}
                                                <strong
                                                    className={`font-extrabold ${
                                                        hasPromo
                                                            ? 'text-rose-600'
                                                            : isMiddle
                                                                ? 'text-blue-700'
                                                                : 'text-slate-900'
                                                    }`}
                                                >
                                                    {Number(priceVal || 0).toLocaleString('vi-VN')} VND
                                                </strong>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Dòng 2: Diện tích */}
                                <tr>
                                    <td className="sticky left-0 z-10 bg-white py-2.5 sm:py-4 px-2.5 sm:px-6 font-semibold text-slate-800 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)]">
                                        <span className="inline-flex items-center gap-1.5 sm:gap-2.5">
                                            <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 shrink-0" />
                                            <span>Diện tích sàn</span>
                                        </span>
                                    </td>
                                    {comparedRooms.map((room, idx) => {
                                        const isMiddle = comparedRooms.length === 3 && idx === 1;
                                        return (
                                            <td
                                                key={room.id}
                                                className={`py-2.5 px-3 sm:py-4 sm:px-5 text-center font-semibold text-slate-700 ${
                                                    isMiddle ? 'bg-sky-50/45 text-slate-900' : ''
                                                }`}
                                            >
                                                {room.size ? `${room.size} m²` : '—'}
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Dòng 3: Tiêu chuẩn giường */}
                                <tr>
                                    <td className="sticky left-0 z-10 bg-white py-2.5 sm:py-4 px-2.5 sm:px-6 font-semibold text-slate-800 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)]">
                                        <span className="inline-flex items-center gap-1.5 sm:gap-2.5">
                                            <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 shrink-0" />
                                            <span>Tiêu chuẩn giường</span>
                                        </span>
                                    </td>
                                    {comparedRooms.map((room, idx) => {
                                        const isMiddle = comparedRooms.length === 3 && idx === 1;
                                        return (
                                            <td
                                                key={room.id}
                                                className={`py-2.5 px-3 sm:py-4 sm:px-5 text-center font-medium text-slate-700 ${
                                                    isMiddle ? 'bg-sky-50/45 text-blue-800 font-semibold' : ''
                                                }`}
                                            >
                                                {room.bed_type || '—'}
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Dòng 4: Sức chứa tối đa */}
                                <tr>
                                    <td className="sticky left-0 z-10 bg-white py-2.5 sm:py-4 px-2.5 sm:px-6 font-semibold text-slate-800 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)]">
                                        <span className="inline-flex items-center gap-1.5 sm:gap-2.5">
                                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 shrink-0" />
                                            <span>Sức chứa</span>
                                        </span>
                                    </td>
                                    {comparedRooms.map((room, idx) => {
                                        const isMiddle = comparedRooms.length === 3 && idx === 1;
                                        return (
                                            <td
                                                key={room.id}
                                                className={`py-2.5 px-3 sm:py-4 sm:px-5 text-center font-medium text-slate-700 ${
                                                    isMiddle ? 'bg-sky-50/45' : ''
                                                }`}
                                            >
                                                {room.capacity ? `${room.capacity} người lớn` : '—'}
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Các dòng tiện nghi thật từ Database */}
                                {comparedAmenityNames.map((amenityName) => {
                                    const AmenityIcon = getAmenityIcon(amenityName);
                                    return (
                                        <tr key={amenityName}>
                                            <td className="sticky left-0 z-10 bg-white py-2.5 sm:py-4 px-2.5 sm:px-6 font-semibold text-slate-800 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)]">
                                                <span className="inline-flex items-center gap-1.5 sm:gap-2.5">
                                                    <AmenityIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 shrink-0" />
                                                    <span>{amenityName}</span>
                                                </span>
                                            </td>
                                            {comparedRooms.map((room, idx) => {
                                                const isMiddle = comparedRooms.length === 3 && idx === 1;
                                                const isTop = comparedRooms.length >= 2 && idx === comparedRooms.length - 1;
                                                const hasAmenity = extractRoomAmenityNames(room).includes(amenityName);
                                                return (
                                                    <td
                                                        key={room.id}
                                                        className={`py-2.5 px-3 sm:py-4 sm:px-5 text-center ${
                                                            isMiddle ? 'bg-sky-50/45' : ''
                                                        }`}
                                                    >
                                                        {hasAmenity ? (
                                                            <CheckCircle2
                                                                className={`w-4 h-4 sm:w-5 sm:h-5 mx-auto ${
                                                                    isTop
                                                                        ? 'text-amber-600'
                                                                        : 'text-blue-600'
                                                                }`}
                                                            />
                                                        ) : (
                                                            <span className="text-slate-300 font-bold">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}

                                {/* Dòng liên kết xem chi tiết từng hạng phòng */}
                                <tr className="bg-slate-50/40">
                                    <td className="sticky left-0 z-10 bg-slate-50 py-2.5 sm:py-4 px-2.5 sm:px-6 text-[11px] sm:text-xs font-medium text-slate-500 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)]">
                                        Chi tiết hạng phòng
                                    </td>
                                    {comparedRooms.map((room, idx) => {
                                        const isMiddle = comparedRooms.length === 3 && idx === 1;
                                        return (
                                            <td
                                                key={room.id}
                                                className={`py-2.5 px-3 sm:py-4 sm:px-5 text-center ${
                                                    isMiddle ? 'bg-sky-50/45' : ''
                                                }`}
                                            >
                                                <Link
                                                    to={`/rooms/${room.id}`}
                                                    state={{
                                                        checkInDate: effectiveCheckIn,
                                                        checkOutDate: effectiveCheckOut,
                                                        guestCount: effectiveGuests
                                                    }}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900 transition"
                                                >
                                                    <span>Xem phòng</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </Link>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}
