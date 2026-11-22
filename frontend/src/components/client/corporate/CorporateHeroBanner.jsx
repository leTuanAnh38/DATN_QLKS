import React from 'react';
import { Percent, Receipt, Headphones } from 'lucide-react';

/**
 * Banner giới thiệu đặc quyền đặt phòng đoàn B2B / Doanh nghiệp
 */
export default function CorporateHeroBanner({ settings }) {
    return (
        <header className="relative w-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50/50 border-b border-slate-200/90 shadow-xs">
            {/* Ảnh resort sáng nét, phủ nhẹ ở nửa bên phải (md:w-1/2) */}
            <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 overflow-hidden pointer-events-none opacity-55 md:opacity-95">
                <img
                    src={settings?.banner_corporate || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85"}
                    alt="Đặt phòng theo đoàn khách sạn TA Đà Nẵng"
                    className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/55 to-transparent" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-24">
                <div className="space-y-6 max-w-2xl lg:max-w-3xl">
                    <div className="space-y-3.5">
                        <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
                            DỊCH VỤ DOANH NGHIỆP & HỘI THẢO
                        </span>
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                            Khách Hàng Doanh Nghiệp <br className="hidden sm:inline" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700">
                                & Đặt Phòng Theo Đoàn
                            </span>
                        </h1>
                        <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal max-w-2xl">
                            Giải pháp lưu trú toàn diện cho công tác, hội thảo và du lịch tập thể. Đặt nhiều phòng cùng lúc với chiết khấu hợp đồng ưu đãi, xuất Hóa đơn GTGT (VAT) điện tử hợp lệ và điều phối chuyên nghiệp.
                        </p>
                    </div>

                    {/* Các tiện ích & đặc quyền dành riêng cho đoàn */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4 border-t border-slate-200/80 max-w-2xl">
                        <div className="flex items-center gap-3 bg-white/95 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200/70 shadow-2xs">
                                <Percent className="w-5 h-5 text-sky-600" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900">Chiết Khấu B2B</h4>
                                <p className="text-[11px] text-slate-500">Ưu đãi theo hợp đồng</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/95 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/70 shadow-2xs">
                                <Receipt className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900">Hóa Đơn VAT</h4>
                                <p className="text-[11px] text-slate-500">Xuất hóa đơn hợp lệ</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/95 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200/70 shadow-2xs">
                                <Headphones className="w-5 h-5 text-sky-600" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900">Trợ Lý Đoàn</h4>
                                <p className="text-[11px] text-slate-500">Hỗ trợ check-in 24/7</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

