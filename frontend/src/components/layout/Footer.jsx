import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useHotelSettings } from '../../store/hotelSettingStore';

export default function Footer() {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const { settings: hotelInfo } = useHotelSettings();

    const handleSubscribe = (e) => {
        e.preventDefault();
        if (email.trim()) {
            setSubscribed(true);
            setEmail('');
            setTimeout(() => setSubscribed(false), 4000);
        }
    };

    return (
        <footer className="bg-white border-t border-slate-200 pt-16 pb-12 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                    {/* Column 1: Brand Info */}
                    <div>
                        <Link to="/" className="flex items-center space-x-3 mb-4 inline-flex group">
                            {hotelInfo.logo_url ? (
                                <img
                                    src={hotelInfo.logo_url}
                                    alt={hotelInfo.hotel_name}
                                    className="h-10 max-w-[140px] object-contain rounded-lg shadow-xs group-hover:scale-105 transition-transform"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-serif font-black text-base group-hover:scale-105 transition-transform">
                                    TA
                                </div>
                            )}
                            <span className="font-serif font-bold text-slate-900 text-base tracking-wide uppercase group-hover:text-blue-600 transition-colors">
                                {hotelInfo.hotel_name || 'KHÁCH SẠN TA ĐÀ NẴNG'}
                            </span>
                        </Link>
                        <div className="flex items-center gap-0.5 text-amber-500 text-xs mb-3">
                            {Array.from({ length: hotelInfo.stars || 3 }).map((_, i) => (
                                <span key={i}>★</span>
                            ))}
                            <span className="text-[11px] font-medium text-slate-500 ml-1.5">
                                Khách sạn {hotelInfo.stars || 3} Sao
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed mb-4">
                            {hotelInfo.description || `Kiệt tác nghỉ dưỡng ${hotelInfo.stars || 3} sao giao hòa giữa vẻ đẹp di sản truyền thống và kiến trúc hiện đại chuẩn quốc tế. Nơi tái định nghĩa chuẩn mực sang trọng và sự thư thái tinh khiết.`}
                        </p>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 inline-block text-xs">
                            <span className="font-bold text-slate-800">🏆 WINNER 2024</span>
                            <span className="block text-slate-500 text-[11px]">World Luxury Hotel Awards</span>
                        </div>
                    </div>

                    {/* Column 2: Resorts */}
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Khu nghỉ dưỡng</h5>
                        <div className="space-y-3 text-xs text-slate-600">
                            <div>
                                <strong className="block text-slate-900 font-semibold">{hotelInfo.hotel_name} (Flagship)</strong>
                                <p className="text-slate-500">{hotelInfo.address}</p>
                                <a href={`tel:${hotelInfo.phone_number.replace(/\s+/g, '')}`} className="text-blue-600 font-medium hover:underline">{hotelInfo.phone_number}</a>
                            </div>
                            <div>
                                <strong className="block text-slate-900 font-semibold">Khách Sạn TA Phú Quốc (Resort)</strong>
                                <p className="text-slate-500">Khu phức hợp Bãi Trường, Dương Tơ, TP. Phú Quốc, Kiên Giang</p>
                                <a href="tel:+842973889911" className="text-blue-600 font-medium hover:underline">+84 (0) 297 388 9911</a>
                            </div>
                        </div>
                    </div>

                    {/* Column 3: Quick Navigation */}
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Khám phá & Dịch vụ</h5>
                        <ul className="space-y-2 text-xs text-slate-600">
                            <li><Link to="/rooms" className="hover:text-blue-600 transition">Phòng nghỉ & Suites Cao Cấp</Link></li>
                            <li><Link to="/services" className="hover:text-blue-600 transition">Menu Dịch Vụ & Ẩm Thực Tại Phòng</Link></li>
                            <li><Link to="/promotions" className="hover:text-blue-600 transition">Ưu đãi & Gói nghỉ dưỡng</Link></li>
                            <li><Link to="/corporate-booking" className="hover:text-blue-600 transition font-medium text-blue-700">Khách đoàn & Doanh nghiệp (B2B)</Link></li>
                            <li><Link to="/login" className="hover:text-blue-600 transition text-amber-600 font-semibold">Hội viên TA Club: Đăng nhập / Đăng ký</Link></li>
                        </ul>
                    </div>

                    {/* Column 4: Newsletter */}
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Bản Tin Đặc Quyền</h5>
                        <p className="text-xs text-slate-500 mb-3">
                            Đăng ký nhận thông tin độc quyền về các kỳ nghỉ phiên bản giới hạn và ưu đãi hội viên VIP.
                        </p>
                        {subscribed ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-medium">
                                ✓ Cảm ơn quý khách đã đăng ký nhận bản tin VIP!
                            </div>
                        ) : (
                            <form onSubmit={handleSubscribe} className="flex items-center">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Địa chỉ email của quý khách..."
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-xs rounded-l-lg focus:outline-none focus:border-blue-600"
                                />
                                <button
                                    type="submit"
                                    aria-label="Đăng ký nhận bản tin"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold rounded-r-lg transition"
                                >
                                    →
                                </button>
                            </form>
                        )}
                        <span className="block text-[10px] text-slate-400 mt-2">
                            Bảo mật thông tin tuyệt đối theo chuẩn quốc tế.
                        </span>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
                    <p>© 2025 Khách Sạn TA Đà Nẵng. All rights reserved.</p>
                    <div className="flex items-center space-x-6">
                        <Link to="/contact" className="hover:underline">Điều khoản dịch vụ</Link>
                        <Link to="/contact" className="hover:underline">Chính sách bảo mật</Link>
                        <Link to="/contact" className="hover:underline">Sơ đồ địa điểm</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
