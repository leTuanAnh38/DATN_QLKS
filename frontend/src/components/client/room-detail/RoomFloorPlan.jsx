import React from 'react';
import { BedDouble, Bath, Sparkles, Maximize2 } from 'lucide-react';

/**
 * Sơ đồ phân khu minh họa thích ứng theo dữ liệu thực tế của từng hạng phòng
 * (diện tích, sức chứa, loại giường, tiện nghi ban công / jacuzzi & tầm nhìn).
 */
export default function RoomFloorPlan({
    room,
    roomHasJacuzzi = false,
    roomHasBalcony = false,
    roomViewText = 'Hướng biển & vườn xanh mát'
}) {
    if (!room) return null;

    const totalArea = Number(room.size) || 32;
    const capacity = Number(room.capacity) || 2;
    const nameLower = (room.name || '').toLowerCase();
    const bedLower = (room.bed_type || '').toLowerCase();
    const combinedText = `${nameLower} ${bedLower}`;

    const isTwinBeds = /(twin|2\s*giường|hai\s*giường|2\s*single|2\s*double|2\s*queen)/.test(combinedText);
    const isPenthouse =
        /(penthouse|president|tổng\s*thống|villa)/.test(nameLower) || totalArea >= 90;
    const isSuite =
        !isPenthouse && (/(suite|executive|grand|junior)/.test(nameLower) || totalArea >= 55);
    const isFamily =
        !isPenthouse &&
        !isSuite &&
        (/(family|gia\s*đình|connecting|liền\s*kề)/.test(nameLower) || capacity >= 4);
    const isDeluxe =
        !isPenthouse &&
        !isSuite &&
        !isFamily &&
        (totalArea >= 34 || roomHasBalcony || /(deluxe|ocean|biển|premier)/.test(nameLower));

    const layoutType = isPenthouse
        ? 'penthouse'
        : isSuite
          ? 'suite'
          : isFamily
            ? 'family'
            : isDeluxe
              ? 'deluxe'
              : 'standard';

    const viewShort = (roomViewText || '').toLowerCase().includes('biển')
        ? 'VIEW BIỂN'
        : (roomViewText || '').toLowerCase().includes('vườn')
          ? 'VIEW VƯỜN'
          : (roomViewText || '').toLowerCase().includes('sông')
            ? 'VIEW SÔNG'
            : (roomViewText || '').toLowerCase().includes('hồ bơi')
              ? 'VIEW HỒ BƠI'
              : 'TOÀN CẢNH';

    const layoutMeta = {
        penthouse: {
            heading: 'Sơ đồ phân khu Penthouse',
            badge: `${totalArea} M² • PENTHOUSE`,
            title: 'Phân khu đa gian thượng lưu & không gian mở Panorama',
            desc: `Tổng diện tích ${totalArea} m² cho tối đa ${capacity} khách, bố trí tách biệt khu vực phòng khách – tiếp đãi, phòng ngủ Master (${room.bed_type || 'giường King'}), khu phòng tắm thư giãn${roomHasJacuzzi ? ' kèm bồn sục Jacuzzi' : ''} và ${roomHasBalcony ? 'sân hiên / ban công rộng' : 'hệ kính toàn cảnh'} (${roomViewText.toLowerCase()}).`
        },
        suite: {
            heading: 'Sơ đồ phân khu Suite',
            badge: `${totalArea} M² • SUITE`,
            title: 'Tách biệt phòng khách & không gian nghỉ ngơi riêng tư',
            desc: `Không gian ${totalArea} m² dành cho tối đa ${capacity} khách được chia thành 2 gian rõ rệt: phòng khách tiếp đón riêng biệt, phòng ngủ yên tĩnh với ${room.bed_type || 'giường King cao cấp'}, khu tủ đồ riêng và phòng tắm tiện nghi${roomHasJacuzzi ? ' có bồn sục Jacuzzi' : ''}.`
        },
        family: {
            heading: 'Sơ đồ phân khu phòng Gia đình',
            badge: `${totalArea} M² • ${capacity} KHÁCH`,
            title: 'Bố cục rộng rãi tối ưu cho gia đình & nhóm bạn',
            desc: `Diện tích ${totalArea} m² phù hợp tối đa ${capacity} khách với cấu hình ${room.bed_type || '2 giường lớn'}, kết hợp khoảng sinh hoạt chung thoáng đãng, lối đi rộng rãi và ${roomHasBalcony ? 'ban công đón gió tự nhiên' : 'cửa sổ kính sáng'} (${roomViewText.toLowerCase()}).`
        },
        deluxe: {
            heading: 'Sơ đồ phân khu phòng Deluxe',
            badge: `${totalArea} M² • DELUXE`,
            title: 'Thiết kế mở tối ưu ánh sáng & tầm nhìn nghỉ dưỡng',
            desc: `Phòng nghỉ ${totalArea} m² dành cho ${capacity} khách với ${room.bed_type || 'giường tiêu chuẩn'}, khu vực bàn làm việc – thư giãn hướng ra ${roomHasBalcony ? 'ban công riêng' : 'khung cửa kính lớn'} (${roomViewText.toLowerCase()}) cùng phòng tắm riêng hiện đại.`
        },
        standard: {
            heading: 'Sơ đồ phân khu phòng Tiêu chuẩn',
            badge: `${totalArea} M² • COMPACT`,
            title: 'Bố trí tinh gọn, đầy đủ công năng lưu trú',
            desc: `Không gian ${totalArea} m² được sắp xếp khoa học cho ${capacity} khách gồm khu ngủ với ${room.bed_type || 'giường êm ái'}, góc bàn làm việc sát cửa sổ (${roomViewText.toLowerCase()}), tủ hành lý gọn gàng và phòng tắm kính khép kín.`
        }
    }[layoutType];

    // Biểu tượng giường thu nhỏ (1 giường lớn hoặc 2 giường Twin theo bed_type thực)
    const renderBedVisual = (forceTwo = false) => {
        const twoBeds = forceTwo || isTwinBeds;
        if (twoBeds) {
            return (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="w-6 h-8 rounded-md border border-blue-400/70 bg-blue-50/70 flex flex-col items-center pt-1">
                        <span className="w-3.5 h-1.5 rounded-xs bg-blue-300/80" />
                    </span>
                    <span className="w-6 h-8 rounded-md border border-blue-400/70 bg-blue-50/70 flex flex-col items-center pt-1">
                        <span className="w-3.5 h-1.5 rounded-xs bg-blue-300/80" />
                    </span>
                </div>
            );
        }
        return (
            <div className="mt-1 w-11 h-8 rounded-md border border-blue-400/70 bg-blue-50/70 flex items-start justify-center gap-1 pt-1">
                <span className="w-3.5 h-1.5 rounded-xs bg-blue-300/80" />
                <span className="w-3.5 h-1.5 rounded-xs bg-blue-300/80" />
            </div>
        );
    };

    const renderBlueprint = () => {
        // 1. PENTHOUSE / PRESIDENTIAL LAYOUT
        if (layoutType === 'penthouse') {
            return (
                <div className="flex flex-col gap-2 h-[230px] sm:h-[245px]">
                    {/* Dải trên cùng: Sky Terrace / Ban công Panorama + Jacuzzi */}
                    <div className="h-[58px] rounded-lg border border-dashed border-blue-300 bg-blue-100/55 flex items-center justify-between px-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
                            {roomHasBalcony ? `SKY TERRACE • ${viewShort}` : `KÍNH PANORAMA • ${viewShort}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white/90 border border-blue-300 text-[10px] font-extrabold text-blue-700 uppercase">
                            {roomHasJacuzzi ? 'JACUZZI / LOUNGE' : 'GHẾ THƯ GIÃN'}
                        </span>
                    </div>

                    {/* Gian giữa & dưới: Phòng khách lớn + Master Bedroom + Phòng tắm Spa */}
                    <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-5 rounded-lg border border-slate-200/90 bg-white/85 flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                PHÒNG KHÁCH &amp; BÀN ĂN
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Khu tiếp đãi riêng</span>
                        </div>
                        <div className="col-span-4 rounded-lg border border-slate-200/90 bg-white/90 flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                MASTER BEDROOM
                            </span>
                            {renderBedVisual(false)}
                        </div>
                        <div className="col-span-3 grid grid-rows-2 gap-2">
                            <div className="rounded-lg border border-slate-200/90 bg-blue-50/50 flex items-center justify-center p-1 text-center">
                                <span className="text-[10px] font-extrabold uppercase text-blue-700 leading-tight">
                                    {roomHasJacuzzi ? 'SPA & JACUZZI' : 'PHÒNG TẮM'}
                                </span>
                            </div>
                            <div className="rounded-lg border border-slate-200/90 bg-white/85 flex items-center justify-center p-1 text-center">
                                <span className="text-[10px] font-bold uppercase text-slate-500 leading-tight">
                                    CLOSET &amp; SẢNH
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // 2. SUITE LAYOUT (Phòng khách + Phòng ngủ tách biệt)
        if (layoutType === 'suite') {
            return (
                <div className="grid grid-cols-12 gap-2 h-[225px] sm:h-[240px]">
                    <div className="col-span-3 rounded-lg border border-dashed border-blue-300 bg-blue-100/50 flex items-center justify-center p-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700 [writing-mode:vertical-rl] rotate-180 select-none text-center">
                            {roomHasBalcony ? `BAN CÔNG ${viewShort}` : `KÍNH ${viewShort}`}
                        </span>
                    </div>

                    <div className="col-span-5 grid grid-rows-2 gap-2">
                        <div className="rounded-lg border border-slate-200/90 bg-white/85 flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                PHÒNG KHÁCH
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Sofa &amp; bàn trà</span>
                        </div>
                        <div className="rounded-lg border border-slate-200/90 bg-white/90 flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                PHÒNG NGỦ
                            </span>
                            {renderBedVisual()}
                        </div>
                    </div>

                    <div className="col-span-4 grid grid-rows-2 gap-2">
                        <div className="rounded-lg border border-slate-200/90 bg-blue-50/45 flex items-center justify-center p-2">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-blue-500/80 bg-blue-100/75 flex items-center justify-center text-center px-1 shadow-2xs">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 leading-tight">
                                    {roomHasJacuzzi ? 'JACUZZI' : 'PHÒNG TẮM'}
                                </span>
                            </div>
                        </div>
                        <div className="rounded-lg border border-slate-200/90 bg-white/85 flex items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                                WALK-IN CLOSET
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        // 3. FAMILY / MULTI-GUEST LAYOUT (2 khu giường rõ ràng)
        if (layoutType === 'family') {
            return (
                <div className="flex flex-col gap-2 h-[225px] sm:h-[240px]">
                    <div className="h-[42px] rounded-lg border border-dashed border-blue-300 bg-blue-100/50 flex items-center justify-center px-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
                            {roomHasBalcony ? `BAN CÔNG ${viewShort}` : `CỬA SỔ LỚN • ${viewShort}`}
                        </span>
                    </div>

                    <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-8 flex flex-col gap-2">
                            <div className="flex-1 rounded-lg border border-slate-200/90 bg-white/90 flex flex-col items-center justify-center p-2 text-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                    KHU NGỦ GIA ĐÌNH ({capacity} KHÁCH)
                                </span>
                                {renderBedVisual(true)}
                            </div>
                            <div className="h-[46px] rounded-lg border border-slate-200/90 bg-white/80 flex items-center justify-center px-2 text-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    KHU SINH HOẠT CHUNG &amp; BÀN TRÀ
                                </span>
                            </div>
                        </div>

                        <div className="col-span-4 grid grid-rows-2 gap-2">
                            <div className="rounded-lg border border-slate-200/90 bg-blue-50/45 flex items-center justify-center p-2 text-center">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 leading-tight">
                                    {roomHasJacuzzi ? 'PHÒNG TẮM & BỒN TẮM' : 'PHÒNG TẮM LỚN'}
                                </span>
                            </div>
                            <div className="rounded-lg border border-slate-200/90 bg-white/85 flex items-center justify-center p-2 text-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                                    TỦ ĐỒ &amp; LỐI VÀO
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // 4. DELUXE LAYOUT (Ban công dọc + Phòng ngủ chính rộng + Bàn làm việc & Phòng tắm)
        if (layoutType === 'deluxe') {
            return (
                <div className="grid grid-cols-12 gap-2 h-[220px] sm:h-[235px]">
                    <div className="col-span-3 rounded-lg border border-dashed border-blue-300 bg-blue-100/50 flex items-center justify-center p-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700 [writing-mode:vertical-rl] rotate-180 select-none text-center">
                            {roomHasBalcony ? `BAN CÔNG ${viewShort}` : `KÍNH ${viewShort}`}
                        </span>
                    </div>

                    <div className="col-span-5 flex flex-col gap-2">
                        <div className="flex-1 rounded-lg border border-slate-200/90 bg-white/90 flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                PHÒNG NGỦ CHÍNH
                            </span>
                            {renderBedVisual()}
                        </div>
                        <div className="h-[52px] rounded-lg border border-slate-200/90 bg-white/80 flex items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                GÓC THƯ GIÃN &amp; BÀN LÀM VIỆC
                            </span>
                        </div>
                    </div>

                    <div className="col-span-4 grid grid-rows-2 gap-2">
                        <div className="rounded-lg border border-slate-200/90 bg-blue-50/45 flex items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 leading-tight">
                                {roomHasJacuzzi ? 'BỒN TẮM & WC' : 'PHÒNG TẮM KÍNH'}
                            </span>
                        </div>
                        <div className="rounded-lg border border-slate-200/90 bg-white/85 flex items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                                TỦ ĐỒ &amp; LỐI VÀO
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        // 5. STANDARD COMPACT LAYOUT (Tinh gọn, không vẽ ô phòng khách thừa)
        return (
            <div className="flex flex-col gap-2 h-[215px] sm:h-[230px]">
                <div className="h-[38px] rounded-lg border border-dashed border-blue-300 bg-blue-100/50 flex items-center justify-center px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
                        CỬA SỔ ĐÓN SÁNG • {viewShort}
                    </span>
                </div>

                <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-7 flex flex-col gap-2">
                        <div className="flex-1 rounded-lg border border-slate-200/90 bg-white/90 flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                KHÔNG GIAN NGỦ
                            </span>
                            {renderBedVisual()}
                        </div>
                        <div className="h-[44px] rounded-lg border border-slate-200/90 bg-white/80 flex items-center justify-center px-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                BÀN LÀM VIỆC &amp; MINIBAR
                            </span>
                        </div>
                    </div>

                    <div className="col-span-5 grid grid-rows-2 gap-2">
                        <div className="rounded-lg border border-slate-200/90 bg-blue-50/45 flex items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 leading-tight">
                                PHÒNG TẮM KÍNH
                            </span>
                        </div>
                        <div className="rounded-lg border border-slate-200/90 bg-white/85 flex items-center justify-center p-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                                TỦ ĐỒ &amp; LỐI VÀO
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <section className="space-y-4">
            {/* Header phía trên thẻ trắng */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                    <span className="block text-[11px] uppercase font-bold tracking-[0.16em] text-blue-700 mb-1">
                        MẶT BẰNG PHÂN KHU
                    </span>
                    <h3 className="font-serif text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight leading-snug">
                        {layoutMeta.heading}
                    </h3>
                </div>
                <span className="text-xs font-medium text-slate-400">
                    Sơ đồ phân khu minh họa
                </span>
            </div>

            {/* Thẻ nội dung trắng */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/70 shadow-[0_10px_35px_-15px_rgba(15,23,42,0.07)]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
                    {/* CỘT TRÁI: BẢN VẼ FLOOR PLAN WIREFRAME THEO PHÂN KHÚC PHÒNG */}
                    <div className="lg:col-span-6 bg-[#f2f5fc] rounded-2xl p-2.5 sm:p-5 overflow-x-auto no-scrollbar">
                        <div className="relative border-2 border-blue-500/80 rounded-xl p-2 sm:p-2.5 bg-white/50 w-full min-w-0">
                            <div className="absolute -top-3 right-3 z-10 px-2.5 py-1 rounded-lg bg-white shadow-sm border border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                {layoutMeta.badge}
                            </div>

                            {renderBlueprint()}
                        </div>
                    </div>

                    {/* CỘT PHẢI: MÔ TẢ PHÂN VÙNG & 2 THẺ THÔNG SỐ THẬT TỪ DATABASE */}
                    <div className="lg:col-span-6 space-y-5">
                        <div className="space-y-2.5">
                            <h4 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                                {layoutMeta.title}
                            </h4>
                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                                {layoutMeta.desc}
                            </p>
                        </div>

                        {/* 2 Thẻ thông số bám sát dữ liệu thực tế của hạng phòng */}
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3.5">
                            <div className="p-4 rounded-2xl bg-[#f4f6fb] border border-slate-200/50 space-y-1">
                                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900">
                                    <BedDouble className="w-4 h-4 text-blue-600 shrink-0" />
                                    <span>Giường &amp; Sức chứa</span>
                                </span>
                                <span className="block text-xs text-slate-600 leading-relaxed">
                                    {room.bed_type || 'Giường tiêu chuẩn'} • Tối đa {capacity} khách
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#f4f6fb] border border-slate-200/50 space-y-1">
                                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900">
                                    {roomHasJacuzzi ? (
                                        <Bath className="w-4 h-4 text-blue-600 shrink-0" />
                                    ) : roomHasBalcony ? (
                                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                                    ) : (
                                        <Maximize2 className="w-4 h-4 text-blue-600 shrink-0" />
                                    )}
                                    <span>{roomHasBalcony ? 'Ban công & Tầm nhìn' : 'Không gian & Tầm nhìn'}</span>
                                </span>
                                <span className="block text-xs text-slate-600 leading-relaxed">
                                    {roomViewText} • {totalArea} m²{roomHasJacuzzi ? ' • Có bồn tắm/Jacuzzi' : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
