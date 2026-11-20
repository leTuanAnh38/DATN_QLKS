import React from 'react';

export default function RoomFloorPlan({
    room,
    roomHasJacuzzi = false,
    roomHasBalcony = false,
    roomViewText = 'Hướng biển & vườn xanh mát'
}) {
    if (!room) return null;

    const totalArea = Number(room.size) || 45;
    const isSuiteOrLarge =
        totalArea >= 55 ||
        (room.name || '').toLowerCase().includes('suite') ||
        (room.name || '').toLowerCase().includes('penthouse');

    // Tính diện tích ước lượng hợp lý theo tổng diện tích thực của từng hạng phòng
    const livingArea = Math.max(14, Math.round(totalArea * 0.34));
    const balconyArea = Math.max(6, Math.round(totalArea * 0.18));
    const bathArea = Math.max(8, Math.round(totalArea * 0.2));

    const viewShort = (roomViewText || '').toLowerCase().includes('biển')
        ? 'VIEW BIỂN'
        : 'TOÀN CẢNH';

    return (
        <section className="space-y-4">
            {/* Header phía trên thẻ trắng giống bản vẽ kiến trúc mẫu */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                    <span className="block text-[11px] uppercase font-bold tracking-[0.16em] text-blue-700 mb-1">
                        MẶT BẰNG BỐ TRÍ
                    </span>
                    <h3 className="font-serif text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight leading-snug">
                        {isSuiteOrLarge
                            ? 'Sơ đồ không gian Suite (Floor Plan)'
                            : 'Sơ đồ không gian phòng (Floor Plan)'}
                    </h3>
                </div>
                <span className="text-xs font-medium text-slate-400">
                    Tỷ lệ kiến trúc 1:50
                </span>
            </div>

            {/* Thẻ nội dung trắng tinh gọn */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/70 shadow-[0_10px_35px_-15px_rgba(15,23,42,0.07)]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
                    {/* CỘT TRÁI: BẢN VẼ FLOOR PLAN WIREFRAME TÔNG XANH SÁNG */}
                    <div className="lg:col-span-6 bg-[#f2f5fc] rounded-2xl p-4 sm:p-6">
                        <div className="relative border-2 border-blue-500/80 rounded-xl p-2.5 bg-white/50">
                            {/* Pill kích thước nổi ở góc trên phải */}
                            <div className="absolute -top-3 right-3 z-10 px-2.5 py-1 rounded-lg bg-white shadow-sm border border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                {totalArea} M² LUXURY LAYOUT
                            </div>

                            {/* Lưới sơ đồ kiến trúc 3 cột */}
                            <div className="grid grid-cols-12 gap-2 h-[220px] sm:h-[240px]">
                                {/* Cột 1 (3.5/12 -> col-span-4): Ban công / Kính toàn cảnh chạy dọc */}
                                <div className="col-span-4 rounded-lg border border-dashed border-blue-300 bg-blue-100/50 flex items-center justify-center p-2">
                                    <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700 [writing-mode:vertical-rl] rotate-180 select-none text-center">
                                        {roomHasBalcony
                                            ? `BAN CÔNG ${viewShort}`
                                            : `KÍNH ${viewShort}`}
                                    </span>
                                </div>

                                {/* Cột 2 (4/12 -> col-span-4): Phòng khách / Tiếp khách & Phòng ngủ */}
                                <div className="col-span-4 grid grid-rows-2 gap-2">
                                    <div className="rounded-lg border border-slate-200/90 bg-white/80 flex items-center justify-center p-2 text-center">
                                        <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            {isSuiteOrLarge ? 'PHÒNG KHÁCH' : 'TIẾP KHÁCH'}
                                        </span>
                                    </div>
                                    <div className="rounded-lg border border-slate-200/90 bg-white/80 flex flex-col items-center justify-center p-2 text-center">
                                        <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                            PHÒNG NGỦ
                                        </span>
                                    </div>
                                </div>

                                {/* Cột 3 (4/12 -> col-span-4): Jacuzzi / Phòng tắm & Walk-in Closet */}
                                <div className="col-span-4 grid grid-rows-2 gap-2">
                                    <div className="rounded-lg border border-slate-200/90 bg-blue-50/40 flex items-center justify-center p-2">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-blue-500/80 bg-blue-100/75 flex items-center justify-center text-center px-1 shadow-2xs">
                                            <span className="text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-wider text-blue-700 leading-tight">
                                                {roomHasJacuzzi ? 'JACUZZI' : 'PHÒNG TẮM'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200/90 bg-white/80 flex items-center justify-center p-2 text-center">
                                        <span className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                                            {isSuiteOrLarge ? 'WALK-IN CLOSET' : 'TỦ ĐỒ & SẢNH'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CỘT PHẢI: MÔ TẢ PHÂN VÙNG & 2 THẺ THÔNG SỐ GỌN ĐẸP */}
                    <div className="lg:col-span-6 space-y-5">
                        <div className="space-y-2.5">
                            <h4 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                                Thiết kế phân vùng mở thông minh
                            </h4>
                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                                {isSuiteOrLarge
                                    ? `Không gian ${totalArea}m² được phân bổ khoa học nhằm tối đa hóa tầm nhìn từ mọi vị trí: khu vực tiếp khách rộng ${livingArea}m² kết nối liền mạch với ${roomHasBalcony ? 'ban công mở' : 'khung kính toàn cảnh'}, phòng ngủ cách âm chuẩn quốc tế đảm bảo sự tĩnh lặng tuyệt đối và phòng tắm đá tự nhiên chuẩn spa.`
                                    : `Phòng nghỉ ${totalArea}m² được quy hoạch tối ưu công năng với ${room.bed_type || 'giường King cao cấp'}, khu vực thư giãn kết nối ánh sáng tự nhiên (${roomViewText.toLowerCase()}), hệ thống cửa cách âm chuyên dụng và phòng tắm riêng tiện nghi.`}
                            </p>
                        </div>

                        {/* 2 Thẻ thông số tối giản đồng bộ mẫu */}
                        <div className="grid grid-cols-2 gap-3.5">
                            <div className="p-4 rounded-2xl bg-[#f4f6fb] border border-slate-200/50">
                                <span className="block text-xs sm:text-sm font-bold text-slate-900">
                                    {roomHasBalcony ? 'Ban công' : 'Tầm nhìn'}
                                </span>
                                <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                                    {roomHasBalcony
                                        ? `${balconyArea} m² lát sàn gỗ teak`
                                        : roomViewText}
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#f4f6fb] border border-slate-200/50">
                                <span className="block text-xs sm:text-sm font-bold text-slate-900">
                                    Phòng tắm
                                </span>
                                <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                                    {roomHasJacuzzi
                                        ? `${bathArea} m² có bồn sục thư giãn`
                                        : `${bathArea} m² buồng tắm kính cao cấp`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
