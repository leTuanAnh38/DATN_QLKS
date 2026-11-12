import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import {
    MapPin,
    Phone,
    Mail,
    Clock,
    Star,
    Send,
    CheckCircle2,
    ShieldCheck,
    Award,
    Compass,
    ChevronRight,
    Building2,
    CreditCard
} from 'lucide-react';
import { useHotelSettings } from '../../store/hotelSettingStore';

export default function Footer() {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const { settings: hotelInfo } = useHotelSettings();

    const currentYear = new Date().getFullYear();
    const hotelName = hotelInfo?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const starsCount = Number(hotelInfo?.stars) || 3;
    const hotline = hotelInfo?.hotline || '1900 8899';
    const phoneNumber = hotelInfo?.phone_number || '+84 (0) 236 388 9900';
    const emailAddress = hotelInfo?.email || 'contact@tahotel.vn';
    const address = hotelInfo?.address || '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng';
    const taxCode = hotelInfo?.tax_code || '0401234567';
    const checkInTime = hotelInfo?.check_in_time || '14:00';
    const checkOutTime = hotelInfo?.check_out_time || '12:00';

    const cleanPhone = (str) => (str ? str.replace(/\s+/g, '') : '');

    const handleSubscribe = (e) => {
        e.preventDefault();
        if (email.trim()) {
            setSubscribed(true);
            setEmail('');
            setTimeout(() => setSubscribed(false), 4500);
        }
    };

    return (
        <footer className="bg-slate-50/90 border-t border-slate-200 text-slate-700 font-sans mt-10 sm:mt-16 pt-10 sm:pt-16 pb-24 sm:pb-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* 4 CỘT CHÍNH */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-7 sm:gap-10 lg:gap-8 pb-8 sm:pb-12 border-b border-slate-200/80">
                    
                    {/* CỘT 1: THƯƠNG HIỆU & GIẢI THƯỞNG (lg:col-span-4) */}
                    <div className="lg:col-span-4 space-y-3.5 sm:space-y-4">
                        <Link to="/" className="inline-flex items-center space-x-3 group">
                            {hotelInfo?.logo_url ? (
                                <img
                                    src={resolveMediaUrl(hotelInfo.logo_url)}
                                    alt={hotelName}
                                    className="h-10 max-w-[140px] object-contain group-hover:scale-105 transition-transform mix-blend-multiply"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-white font-serif font-black text-lg shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                                    TA
                                </div>
                            )}
                            <div className="flex flex-col">
                                <span className="font-serif font-bold text-slate-900 text-base tracking-wide uppercase group-hover:text-amber-600 transition-colors">
                                    {hotelName}
                                </span>
                                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">
                                    {hotelInfo?.hotel_slogan || 'Luxury Resort & Hotel'}
                                </span>
                            </div>
                        </Link>

                        {/* Sao xếp hạng */}
                        <div className="flex items-center gap-1">
                            <div className="flex items-center text-amber-400">
                                {Array.from({ length: starsCount }).map((_, i) => (
                                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <span className="text-xs font-semibold text-slate-600 ml-1.5">
                                Tiêu Chuẩn {starsCount} Sao Quốc Tế
                            </span>
                        </div>

                        {/* Mô tả */}
                        <p className="text-xs text-slate-500 leading-relaxed font-normal">
                            {hotelInfo?.description || `Kiệt tác nghỉ dưỡng ${starsCount} sao giao hòa giữa vẻ đẹp di sản truyền thống và kiến trúc hiện đại chuẩn quốc tế. Nơi tái định nghĩa chuẩn mực sang trọng và sự thư thái tinh khiết.`}
                        </p>

                        {/* Huy hiệu giải thưởng & MST: Lưới 2 cột đều nhau trên mobile */}
                        <div className="pt-1 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
                            <div className="px-3 py-2 bg-white rounded-xl border border-amber-200/80 shadow-xs flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                                <div className="min-w-0">
                                    <span className="font-bold text-slate-900 text-[10.5px] sm:text-[11px] block leading-tight truncate">WINNER 2024–2026</span>
                                    <span className="text-[9.5px] sm:text-[10px] text-slate-500 block truncate">World Luxury Hotel Awards</span>
                                </div>
                            </div>
                            <div className="px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                    <span className="font-bold text-slate-800 text-[10.5px] sm:text-[11px] block leading-tight">Mã Số Thuế</span>
                                    <span className="text-[9.5px] sm:text-[10px] font-mono text-slate-500 block truncate">{taxCode}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CỘT 2: THÔNG TIN LIÊN HỆ & ĐÓN TIẾP (lg:col-span-3) */}
                    <div className="lg:col-span-3 space-y-3 sm:space-y-3.5 text-xs">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 mb-3 sm:mb-4">
                            <Building2 className="w-4 h-4 text-amber-600" />
                            <span>Liên Hệ & Đón Tiếp</span>
                        </h4>

                        <div className="flex items-start gap-2.5 text-slate-600">
                            <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{address}</span>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-medium">Tổng đài CSKH 24/7:</span>
                                <a href={`tel:${cleanPhone(hotline)}`} className="text-amber-700 hover:text-amber-800 font-bold transition">
                                    {hotline}
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-medium">Lễ tân & Đặt phòng:</span>
                                <a href={`tel:${cleanPhone(phoneNumber)}`} className="text-slate-800 hover:text-amber-600 font-semibold transition">
                                    {phoneNumber}
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-medium">Email chính thức:</span>
                                <a href={`mailto:${emailAddress}`} className="text-slate-800 hover:text-amber-600 font-semibold transition">
                                    {emailAddress}
                                </a>
                            </div>
                        </div>

                        {/* Thẻ Check-in / Check-out: Thiết kế 2 cột chuẩn boarding pass */}
                        <div className="p-2.5 sm:p-3 bg-gradient-to-r from-amber-50/90 to-orange-50/60 rounded-xl border border-amber-200/70 grid grid-cols-2 divide-x divide-amber-200/80 gap-2 mt-2 text-[11px] text-amber-950 shadow-2xs">
                            <div className="flex items-center gap-2 pr-1">
                                <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
                                    <Clock className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[9.5px] text-amber-700 font-bold block uppercase tracking-wider">Check-in</span>
                                    <strong className="text-slate-900 font-extrabold">{checkInTime}</strong>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pl-3">
                                <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
                                    <Clock className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[9.5px] text-amber-700 font-bold block uppercase tracking-wider">Check-out</span>
                                    <strong className="text-slate-900 font-extrabold">{checkOutTime}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CỘT 3: KHÁM PHÁ & DỊCH VỤ (lg:col-span-2) */}
                    <div className="lg:col-span-2 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 mb-3 sm:mb-4">
                            <Compass className="w-4 h-4 text-amber-600" />
                            <span>Khám Phá & Dịch Vụ</span>
                        </h4>
                        {/* Lưới 2 cột trên điện thoại để tiết kiệm 50% chiều dài trang */}
                        <ul className="grid grid-cols-2 sm:grid-cols-1 gap-x-3 gap-y-2.5 sm:gap-y-2 text-xs text-slate-600">
                            <li>
                                <Link to="/rooms" className="hover:text-amber-600 transition flex items-center gap-1.5 group">
                                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                                    <span className="truncate">Phòng Nghỉ & Suites</span>
                                </Link>
                            </li>
                            <li>
                                <Link to="/services" className="hover:text-amber-600 transition flex items-center gap-1.5 group">
                                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                                    <span className="truncate">Ẩm Thực & Dịch Vụ</span>
                                </Link>
                            </li>
                            <li>
                                <Link to="/promotions" className="hover:text-amber-600 transition flex items-center gap-1.5 group">
                                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                                    <span className="truncate">Ưu Đãi Đặc Quyền</span>
                                </Link>
                            </li>
                            <li>
                                <Link to="/corporate-booking" className="hover:text-amber-600 transition flex items-center gap-1.5 group font-medium text-amber-800">
                                    <ChevronRight className="w-3 h-3 text-amber-600 transition-colors shrink-0" />
                                    <span className="truncate">Khách Đoàn & MICE</span>
                                </Link>
                            </li>
                            <li>
                                <Link to="/news" className="hover:text-amber-600 transition flex items-center gap-1.5 group">
                                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                                    <span className="truncate">Tin Tức & Cẩm Nang</span>
                                </Link>
                            </li>
                            <li>
                                <Link to="/login" className="hover:text-amber-600 transition flex items-center gap-1.5 group font-semibold text-amber-600">
                                    <ChevronRight className="w-3 h-3 text-amber-600 transition-colors shrink-0" />
                                    <span className="truncate">Hội Viên TA Club</span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* CỘT 4: BẢN TIN ĐẶC QUYỀN & MẠNG XÃ HỘI (lg:col-span-3) */}
                    <div className="lg:col-span-3 space-y-3.5 sm:space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 mb-2">
                            <Send className="w-4 h-4 text-amber-600" />
                            <span>Bản Tin Đặc Quyền</span>
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-normal">
                            Đăng ký nhận thông tin độc quyền về các gói nghỉ dưỡng giới hạn và ưu đãi dành riêng cho hội viên VIP.
                        </p>

                        {subscribed ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-fadeIn">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Cảm ơn quý khách đã đăng ký nhận bản tin VIP!</span>
                            </div>
                        ) : (
                            <form onSubmit={handleSubscribe} className="space-y-2">
                                <div className="relative">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Nhập email của quý khách..."
                                        className="w-full bg-white border border-slate-200 pl-3.5 pr-11 py-2.5 text-xs rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-800 placeholder:text-slate-400 shadow-xs transition"
                                    />
                                    <button
                                        type="submit"
                                        aria-label="Đăng ký nhận bản tin"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white p-2 rounded-lg transition shadow-xs cursor-pointer"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <span className="block text-[10px] text-slate-400">
                                    * Cam kết bảo mật thông tin tuyệt đối theo chuẩn quốc tế.
                                </span>
                            </form>
                        )}

                        {/* MẠNG XÃ HỘI */}
                        <div className="pt-1.5 sm:pt-2">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Kết Nối Cùng Khách Sạn
                            </span>
                            <div className="flex items-center gap-2">
                                {/* Facebook */}
                                <a
                                    href="https://facebook.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Facebook"
                                    className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 flex items-center justify-center transition shadow-xs active:scale-95"
                                >
                                    <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                                        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                                    </svg>
                                </a>
                                {/* Instagram */}
                                <a
                                    href="https://instagram.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Instagram"
                                    className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 flex items-center justify-center transition shadow-xs active:scale-95"
                                >
                                    <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                    </svg>
                                </a>
                                {/* YouTube */}
                                <a
                                    href="https://youtube.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="YouTube"
                                    className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 flex items-center justify-center transition shadow-xs active:scale-95"
                                >
                                    <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                    </svg>
                                </a>
                                {/* TikTok */}
                                <a
                                    href="https://tiktok.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="TikTok"
                                    className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 flex items-center justify-center transition shadow-xs active:scale-95"
                                >
                                    <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.02 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* THANH PHƯƠNG THỨC THANH TOÁN (PAYMENT BADGES) */}
                <div className="py-4 sm:py-6 border-b border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Phương thức thanh toán chấp nhận:</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                        {['VietQR', 'VNPay', 'Visa', 'MasterCard', 'JCB', 'MoMo', 'Tiền mặt'].map((method) => (
                            <span
                                key={method}
                                className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white border border-slate-200/90 rounded-md text-[10.5px] sm:text-[11px] font-bold text-slate-700 shadow-2xs hover:border-amber-300 transition"
                            >
                                {method}
                            </span>
                        ))}
                    </div>
                </div>

                {/* DÒNG BẢN QUYỀN & LIÊN KẾT PHÁP LÝ */}
                <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2.5 sm:gap-3 text-center sm:text-left">
                    <p>© {currentYear} {hotelName}. Tất cả quyền được bảo lưu.</p>
                    <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-1">
                        <Link to="/contact" className="hover:text-amber-600 transition">Điều khoản dịch vụ</Link>
                        <span className="text-slate-300">•</span>
                        <Link to="/contact" className="hover:text-amber-600 transition">Chính sách bảo mật</Link>
                        <span className="text-slate-300">•</span>
                        <Link to="/contact" className="hover:text-amber-600 transition">Sơ đồ & Chỉ đường</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
