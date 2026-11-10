import React from 'react';
import { Percent, Receipt, Headphones } from 'lucide-react';

/**
 * Banner giới thiệu đặc quyền đặt phòng đoàn B2B / Doanh nghiệp
 */
export default function CorporateHeroBanner({ settings }) {
    return (
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-white to-amber-50/40 border border-slate-200/90 shadow-md">
            {/* Ảnh resort sáng nét, phủ nhẹ ở góc phải */}
            <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 overflow-hidden pointer-events-none opacity-60 md:opacity-95">
                <img
                    src={settings?.banner_corporate || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"}
                    alt="Đặt phòng theo đoàn khách sạn TA Đà Nẵng"
                    className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/45 to-transparent" />
            </div>

            <div className="relative z-10 p-6 sm:p-10 space-y-6 max-w-2xl">
                <div className="space-y-3">
                    <h1 className="font-serif text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        Khách Hàng Doanh Nghiệp <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700">
                            & Đặt Phòng Theo Đoàn
                        </span>
                    </h1>
                    <p className="text-slate-600 text-xs sm:text-sm sm:leading-relaxed font-normal">
                        Giải pháp lưu trú toàn diện cho công tác, hội thảo và du lịch tập thể. Đặt nhiều phòng cùng lúc với chiết khấu hợp đồng ưu đãi, xuất Hóa đơn GTGT (VAT) điện tử hợp lệ và điều phối chuyên nghiệp.
                    </p>
                </div>

                {/* Các tiện ích & đặc quyền dành riêng cho đoàn */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/80">
                    <div className="flex items-center gap-3 bg-white/95 p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80 shadow-2xs">
                            <Percent className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-900">Chiết Khấu B2B</h4>
                            <p className="text-[11px] text-slate-500">Ưu đãi theo hợp đồng</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/95 p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/80 shadow-2xs">
                            <Receipt className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-900">Hóa Đơn VAT</h4>
                            <p className="text-[11px] text-slate-500">Xuất hóa đơn hợp lệ</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/95 p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80 shadow-2xs">
                            <Headphones className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-900">Trợ Lý Đoàn</h4>
                            <p className="text-[11px] text-slate-500">Hỗ trợ check-in 24/7</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

