import React from 'react';
import {
    DoorClosed,
    Bath,
    BedDouble,
    Compass,
    ShieldCheck
} from 'lucide-react';

export default function RoomFloorPlan({
    room,
    roomHasJacuzzi = false,
    roomHasBalcony = false,
    roomViewText = 'Hướng biển & vườn xanh mát'
}) {
    if (!room) return null;

    return (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                    <span className="text-xs uppercase font-bold tracking-widest text-amber-600">
                        Kiến trúc & Phân vùng không gian
                    </span>
                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                        Sơ đồ mặt bằng & Bố cục phòng nghỉ
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Khám phá cách bố trí công thái học, ánh sáng tự nhiên và luồng di chuyển thư thái trong phòng.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Resort Suite Architectural Blueprint</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* CỘT TRÁI: BẢN VẼ SƠ ĐỒ MẶT BẰNG PHONG CÁCH RESORT BLUEPRINT */}
                <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden border border-slate-800 shadow-xl flex flex-col justify-between min-h-[300px]">
                    {/* Lưới tọa độ kiến trúc mờ tinh tế */}
                    <div
                        className="absolute inset-0 opacity-[0.07] pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />
                    <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Header Blueprint */}
                    <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-mono text-slate-300 uppercase tracking-wider font-semibold text-[11px] truncate max-w-[200px]">
                                {room.name}
                            </span>
                        </div>
                        <span className="font-mono text-amber-300 text-[11px] bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-bold">
                            {room.size ? `${room.size} M² DIỆN TÍCH SÀN` : 'TIÊU CHUẨN'}
                        </span>
                    </div>

                    {/* Khu vực minh họa phân vùng không gian (Architectural Spatial Zones) */}
                    <div className="relative z-10 my-4 grid grid-cols-1 sm:grid-cols-12 gap-3 flex-1">
                        {/* Khu 1: Cửa vào & Tiền sảnh (Foyer) */}
                        <div className="sm:col-span-4 bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-mono tracking-wider">
                                <span>LỐI VÀO</span>
                                <DoorClosed className="w-3.5 h-3.5 text-slate-300" />
                            </div>
                            <div className="my-2">
                                <div className="text-xs font-bold text-white">Sảnh Đón & Tủ Đồ</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">Két sắt & Mini bar</div>
                            </div>
                            <div className="text-[10px] text-amber-300/80 font-mono">STC 55+ Cách âm</div>
                        </div>

                        {/* Khu 2: Phòng tắm & Thư giãn */}
                        <div className="sm:col-span-8 bg-white/5 hover:bg-white/10 transition border border-amber-400/20 rounded-xl p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-amber-300 text-[10px] uppercase font-mono tracking-wider">
                                <span>KHU PHÒNG TẮM</span>
                                <Bath className="w-3.5 h-3.5 text-amber-300" />
                            </div>
                            <div className="my-2 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-bold text-white">
                                        {roomHasJacuzzi ? 'Bồn Tắm Nằm Thư Giãn' : 'Buồng Tắm Đứng Kính Cường Lực'}
                                    </div>
                                    <div className="text-[10px] text-slate-300 mt-0.5">
                                        Vòi sen mưa & Nước nóng 24/7
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                                    Riêng tư
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">Bộ khăn bông cao cấp</div>
                        </div>

                        {/* Khu 3: Không gian ngủ chính (Master Suite) */}
                        <div className="sm:col-span-8 bg-gradient-to-br from-amber-500/15 via-white/5 to-white/5 border border-amber-300/30 rounded-xl p-3.5 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-amber-200 text-[10px] uppercase font-mono tracking-wider">
                                <span>KHÔNG GIAN NGHỈ CHÍNH</span>
                                <BedDouble className="w-4 h-4 text-amber-300" />
                            </div>
                            <div className="my-2">
                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                    <span>{room.bed_type || '1 Giường Đôi King Size'}</span>
                                </div>
                                <div className="text-[11px] text-slate-300 mt-1">
                                    Đệm lò xo túi êm ái • Bàn làm việc & TV màn hình rộng
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono pt-1 border-t border-white/10">
                                <span>Ánh sáng dịu ấm</span>
                                <span className="text-amber-300">Rèm cản sáng 100%</span>
                            </div>
                        </div>

                        {/* Khu 4: Ban công / Cửa sổ toàn cảnh */}
                        <div className="sm:col-span-4 bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-sky-300 text-[10px] uppercase font-mono tracking-wider">
                                <span>{roomHasBalcony ? 'BAN CÔNG' : 'TẦM NHÌN'}</span>
                                <Compass className="w-3.5 h-3.5 text-sky-300" />
                            </div>
                            <div className="my-2">
                                <div className="text-xs font-bold text-white">
                                    {roomHasBalcony ? 'Ban Công Riêng Biệt' : 'Khung Kính Toàn Cảnh'}
                                </div>
                                <div className="text-[10px] text-slate-300 mt-0.5 truncate" title={roomViewText}>
                                    {roomViewText}
                                </div>
                            </div>
                            <div className="text-[10px] text-emerald-400 font-mono">Đón gió tự nhiên</div>
                        </div>
                    </div>

                    {/* Footer Blueprint */}
                    <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-2.5 text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Chuẩn thiết kế công thái học & đối lưu không khí</span>
                        </span>
                        <span className="text-slate-500 hidden sm:inline">
                            Hệ thống PCCC & Thoát hiểm đạt chuẩn
                        </span>
                    </div>
                </div>

                {/* CỘT PHẢI: CHI TIẾT THÔNG SỐ & TIỆN ÍCH PHÂN VÙNG */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                        <h4 className="font-serif font-bold text-lg text-slate-900 leading-tight">
                            Thiết kế không gian tối ưu cho kỳ nghỉ thư thái
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                            Từng mét vuông trong phòng đều được quy hoạch đồng bộ nhằm mang lại sự riêng tư tối đa, tầm nhìn thoáng đãng và trải nghiệm nghỉ dưỡng êm dịu nhất.
                        </p>
                    </div>

                    {/* Lưới 4 thông số kỹ thuật then chốt */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                Diện tích phòng
                            </span>
                            <strong className="text-sm font-bold text-slate-900 block mt-0.5">
                                {room.size ? `${room.size} m²` : '40 m²'}
                            </strong>
                            <span className="text-[10px] text-emerald-600 font-medium">Bố trí rộng rãi</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                Tiêu chuẩn giường
                            </span>
                            <strong
                                className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5 truncate"
                                title={room.bed_type || 'King Bed'}
                            >
                                {room.bed_type || 'King Bed'}
                            </strong>
                            <span className="text-[10px] text-amber-700 font-medium">Đệm cao cấp</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                Khu vệ sinh
                            </span>
                            <strong className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                                {roomHasJacuzzi ? 'Bồn tắm nằm' : 'Phòng tắm đứng'}
                            </strong>
                            <span className="text-[10px] text-slate-500 font-medium">Vòi sen massage</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                Ban công & View
                            </span>
                            <strong
                                className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5 truncate"
                                title={roomViewText}
                            >
                                {roomHasBalcony ? 'Ban công riêng' : 'Khung kính lớn'}
                            </strong>
                            <span className="text-[10px] text-sky-600 font-medium truncate block">
                                {roomViewText}
                            </span>
                        </div>
                    </div>

                    {/* Điểm nhấn bảo đảm chất lượng giấc ngủ */}
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-2.5 text-xs text-amber-900">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-normal">
                            Hệ thống cửa cách âm chuyên dụng và kính chống bức xạ nhiệt giúp không gian bên trong luôn mát mẻ, yên tĩnh tuyệt đối suốt 24 giờ.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

