import React, { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

export default function ContactPage() {
    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        department: 'reservations',
        subject: '',
        message: '',
        receiveViaZalo: false
    });

    const [copiedAddress, setCopiedAddress] = useState(false);
    const [activeFaq, setActiveFaq] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // FAQ list
    const faqs = [
        {
            q: 'Giờ nhận phòng và trả phòng tiêu chuẩn của Khách sạn TA là mấy giờ?',
            a: 'Thời gian nhận phòng tiêu chuẩn (check-in) là từ 14:00 và trả phòng (check-out) trước 12:00 trưa. Khách sạn luôn hỗ trợ nhận phòng sớm hoặc trả phòng muộn linh hoạt tùy theo tình trạng phòng thực tế hoặc đặc quyền hạng phòng/hội viên TA Club.'
        },
        {
            q: 'Khách sạn có dịch vụ nhận gửi hành lý trước check-in hoặc sau check-out không?',
            a: 'Hoàn toàn có và hoàn toàn miễn phí. Đội ngũ Concierge và Bellman tại sảnh chính luôn sẵn sàng lưu trữ hành lý an toàn của quý khách với thẻ hành lý có mã số riêng trong thời gian quý khách dạo chơi hoặc chờ chuyến bay.'
        },
        {
            q: 'Làm thế nào để đặt dịch vụ đưa đón sân bay riêng?',
            a: 'Quý khách có thể tích chọn yêu cầu đón tiễn khi đặt phòng trực tuyến, hoặc điền trực tiếp vào form liên hệ ở trên kèm theo mã số chuyến bay và giờ hạ cánh. Đội xe Mercedes-Benz & DCar VIP của khách sạn sẽ xác nhận lịch đón trước ít nhất 12 giờ.'
        }
    ];

    const handleCopyAddress = () => {
        const address = '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Phường Mỹ An, Quận Ngũ Hành Sơn, Thành phố Đà Nẵng, Việt Nam';
        navigator.clipboard.writeText(address);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2500);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            alert(`Cảm ơn Quý khách ${formData.fullName}! Yêu cầu đã được chuyển tới Ban Quản gia & Bộ phận liên quan. Chúng tôi sẽ phản hồi trong vòng 15 phút.`);
            setFormData({
                fullName: '',
                phone: '',
                email: '',
                department: 'reservations',
                subject: '',
                message: '',
                receiveViaZalo: false
            });
        }, 800);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* Reusable Navbar */}
            <Navbar />


            {/* 3. BREADCRUMB */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <a href="/" className="hover:text-blue-600 transition">Trang chủ</a>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold">Liên hệ & Chỉ dẫn đường đi</span>
                    </nav>
                </div>
            </div>

            {/* 4. HERO HEADER & 3 PILLARS */}
            <section className="pt-10 pb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-10">
                    <span className="inline-block px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider mb-3">
                        🛡️ Dịch vụ Concierge & Chăm sóc Khách hàng 24/7
                    </span>
                    <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                        Kết Nối Với Khách Sạn TA Đà Nẵng
                    </h1>
                    <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
                        Đội ngũ Quản gia & Chuyên viên Chăm sóc Khách hàng luôn sẵn sàng lắng nghe, tư vấn kỳ nghỉ thượng lưu, tiếp nhận đặt dịch vụ ẩm thực, spa hoặc giải đáp mọi yêu cầu riêng biệt của Quý khách với sự chu đáo tuyệt đối.
                    </p>
                </div>

                {/* 3 Guarantees Badges */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-12">
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                            ⏱️
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Tốc độ phản hồi</span>
                            <strong className="text-sm font-bold text-slate-900">Phản hồi trong 15 phút</strong>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl shrink-0">
                            📞
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Tổng đài viên trực tiếp</span>
                            <strong className="text-sm font-bold text-slate-900">Hotline 24/7: 1900 8899</strong>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                            💎
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Tọa độ biển Đà Nẵng</span>
                            <strong className="text-sm font-bold text-slate-900">Kim Cương Bãi Biển Mỹ Khê</strong>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. MAIN SECTION: FORM (LEFT) + DIRECT CONTACT CARD (RIGHT) */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT: INTERACTIVE CONTACT FORM */}
                    <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-10">
                        <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
                            <div>
                                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Thư ký riêng ban quản gia</span>
                                <h2 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                                    Gửi Tin Nhắn & Yêu Cầu Đặt Chỗ Trực Tiếp
                                </h2>
                            </div>
                            <span className="text-2xl text-slate-400">✉️</span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Họ và tên <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Nguyễn Văn A"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Số điện thoại <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="(+84) 90 123 4567"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Địa chỉ email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="guest@domain.com"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Bộ phận tiếp nhận <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                    >
                                        <option value="reservations">Đặt phòng lưu trú & Suite</option>
                                        <option value="dining">Dịch vụ Ẩm thực & Bar (F&B)</option>
                                        <option value="spa">The Lotus Spa & Wellness</option>
                                        <option value="mice">Ban Sự Kiện Đoàn & M.I.C.E</option>
                                        <option value="transport">Đưa đón xe Mercedes Sân Bay</option>
                                        <option value="feedback">Góp ý & Chăm sóc Khách hàng</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Tiêu đề yêu cầu
                                </label>
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="Ví dụ: Đặt phòng Ocean Penthouse dịp kỷ niệm ngày cưới"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Nội dung tin nhắn & Yêu cầu đặc biệt <span className="text-red-500">*</span>
                                    </label>
                                    <span className="text-[11px] text-slate-400">Tùy chọn gối nệm, ăn kiêng, giờ check-in</span>
                                </div>
                                <textarea
                                    rows={4}
                                    required
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Quý khách có thể cung cấp thêm thông tin về số lượng khách, chế độ ăn uống đặc biệt (thuần chay, gluten-free), sở thích gối lông vũ / thảo mộc, hoặc mong muốn đón sân bay chuyên biệt..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                                />
                            </div>

                            <div className="py-1">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={formData.receiveViaZalo}
                                        onChange={(e) => setFormData({ ...formData, receiveViaZalo: e.target.checked })}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>
                                        Tôi muốn nhận tư vấn ưu tiên & xác nhận nhanh qua <strong className="text-blue-600">Zalo / WhatsApp</strong> trên số điện thoại này
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Yêu Cầu Đến Ban Quản Gia'}</span>
                                <span>→</span>
                            </button>

                            <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-2">
                                <span>🛡️</span>
                                <span>Bảo mật dữ liệu chuẩn mã hóa SSL 256-bit. Cam kết phản hồi từ nhân viên trong vòng 15 phút.</span>
                            </div>
                        </form>
                    </div>

                    {/* RIGHT: HEADQUARTERS & SPECIALIZED DEPARTMENTS */}
                    <div className="lg:col-span-5 space-y-6">

                        {/* Flagship Address Box */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div>
                                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block">
                                        Trụ sở nghỉ dưỡng Flagship
                                    </span>
                                    <h3 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                                        Khách Sạn TA Đà Nẵng
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
                                    📍
                                </div>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                                <strong>08 Võ Nguyên Giáp</strong>, Bãi biển Mỹ Khê, Phường Mỹ An, Quận Ngũ Hành Sơn, Thành phố Đà Nẵng, Việt Nam.
                            </p>
                            <p className="text-xs text-slate-500 mb-5 italic">
                                Tọa lạc tại cung đường resort ven biển đẹp nhất Việt Nam, đối diện bãi tắm Mỹ Khê.
                            </p>

                            <div className="flex flex-wrap gap-2.5">
                                <a
                                    href="https://maps.google.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                                >
                                    <span>🗺️</span>
                                    <span>Mở Google Maps</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={handleCopyAddress}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                                >
                                    <span>📋</span>
                                    <span>{copiedAddress ? '✓ Đã chép' : 'Sao chép địa chỉ'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Specialized Departments Contacts */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1">
                                Kênh tiếp nhận chuyên môn
                            </span>
                            <h3 className="font-serif text-lg font-bold text-slate-900 mb-5">
                                Các Phòng Ban Trực Thuộc
                            </h3>

                            <div className="space-y-4 text-xs">
                                {/* 1. Reservations */}
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition flex items-start gap-3.5">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-base shrink-0">🏨</div>
                                    <div>
                                        <strong className="text-slate-900 font-bold block">Phòng Đặt Phòng (Reservations)</strong>
                                        <span className="text-slate-500 block text-[11px]">(+84) 236 388 9900 - <span className="text-blue-600 font-semibold">Ext 1</span></span>
                                        <a href="mailto:booking@tadananghotel.com" className="text-blue-600 hover:underline">booking@tadananghotel.com</a>
                                    </div>
                                </div>

                                {/* 2. Dining & F&B */}
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition flex items-start gap-3.5">
                                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-base shrink-0">🍴</div>
                                    <div>
                                        <strong className="text-slate-900 font-bold block">Dịch Vụ Ẩm Thực & Bar (F&B)</strong>
                                        <span className="text-slate-500 block text-[11px]">(+84) 236 388 9900 - <span className="text-blue-600 font-semibold">Ext 2</span></span>
                                        <a href="mailto:dining@tadananghotel.com" className="text-blue-600 hover:underline">dining@tadananghotel.com</a>
                                    </div>
                                </div>

                                {/* 3. Spa */}
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition flex items-start gap-3.5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-base shrink-0">🪷</div>
                                    <div>
                                        <strong className="text-slate-900 font-bold block">The Lotus Spa & Wellness</strong>
                                        <span className="text-slate-500 block text-[11px]">(+84) 236 388 9900 - <span className="text-blue-600 font-semibold">Ext 3</span></span>
                                        <a href="mailto:spa@tadananghotel.com" className="text-blue-600 hover:underline">spa@tadananghotel.com</a>
                                    </div>
                                </div>

                                {/* 4. Events & MICE */}
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition flex items-start gap-3.5">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-base shrink-0">🏛️</div>
                                    <div>
                                        <strong className="text-slate-900 font-bold block">Ban Sự Kiện Đoàn & M.I.C.E</strong>
                                        <span className="text-slate-500 block text-[11px]">(+84) 236 388 9900 - <span className="text-blue-600 font-semibold">Ext 4</span></span>
                                        <a href="mailto:mice@tadananghotel.com" className="text-blue-600 hover:underline">mice@tadananghotel.com</a>
                                    </div>
                                </div>
                            </div>

                            {/* VIP Emergency Card */}
                            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">Hotline Khẩn Cấp VIP 24/7</span>
                                    <strong className="text-lg font-bold">1900 8899</strong>
                                    <span className="block text-[10px] text-slate-300">Hoặc (+84) 901 234 567</span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg shadow-md">
                                    📞
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 6. INTERACTIVE MAP SECTION & 4 KEY TRAVEL TIMES */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                                Tọa độ đắc địa & Khả năng tiếp cận
                            </span>
                            <h2 className="font-serif text-3xl font-bold text-slate-900 mt-1">
                                Bản Đồ Vị Trí & Hướng Dẫn Di Chuyển
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                                Khách Sạn TA Đà Nẵng sở hữu vị trí mặt tiền biển phong thủy vượng khí, kết nối thông suốt với cảng hàng không quốc tế, ga đường sắt và các di sản văn hóa thế giới lân cận.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                            <span className="text-orange-500">📍</span>
                            <span>Tọa độ GPS: <strong>16.0544° N, 108.2435° E</strong></span>
                        </div>
                    </div>

                    {/* MAP MOCKUP CONTAINER */}
                    <div className="w-full h-96 rounded-3xl overflow-hidden shadow-md border border-slate-200 relative bg-slate-100">
                        {/* Stylized simulated map view */}
                        <img
                            src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1400&q=80"
                            alt="Bản đồ vị trí Khách Sạn TA Đà Nẵng"
                            className="w-full h-full object-cover filter contrast-[0.95]"
                        />
                        <div className="absolute inset-0 bg-blue-900/10 pointer-events-none" />

                        {/* Overlaid Hotel Pin Card */}
                        <div className="absolute top-6 left-6 max-w-xs bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/60">
                            <div className="flex items-center gap-1 text-amber-500 text-xs mb-1">
                                <span>★</span>
                                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-800">5-Star Luxury Resort</span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm">
                                Khách Sạn TA Đà Nẵng
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Q. Ngũ Hành Sơn
                            </p>
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    Trực diện biển Mỹ Khê
                                </span>
                            </div>
                        </div>

                        {/* Bottom Right CTA */}
                        <a
                            href="https://maps.google.com"
                            target="_blank"
                            rel="noreferrer"
                            className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg border border-white/60 flex items-center gap-2 transition"
                        >
                            <span>🧭</span>
                            <span>Tìm đường đi tối ưu</span>
                        </a>
                    </div>

                    {/* 4 TRAVEL TIME CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl">✈️</span>
                                <span className="font-mono text-sm font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">15 phút</span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Sân Bay Quốc Tế (DAD)</h4>
                            <span className="text-[11px] text-slate-400 block mb-2">Khoảng cách: 7.5 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Di chuyển dễ dàng bằng xe đưa đón Limousine riêng của khách sạn hoặc taxi cao cấp dọc cầu Rồng & Nguyễn Văn Linh.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl">🚆</span>
                                <span className="font-mono text-sm font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">12 phút</span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Ga Xe Lửa Đà Nẵng</h4>
                            <span className="text-[11px] text-slate-400 block mb-2">Khoảng cách: 5.8 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Tuyến đường nhanh qua trung tâm thành phố và Cầu Sông Hàn, thuận tiện đón quý khách từ các chuyến tàu hỏa di sản.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl">🏮</span>
                                <span className="font-mono text-sm font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">25 phút</span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Phố Cổ Hội An</h4>
                            <span className="text-[11px] text-slate-400 block mb-2">Khoảng cách: 22 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Cung đường biển thơ mộng Trường Sa - Lạc Long Quân đưa Quý khách đến Di sản Thế giới UNESCO Hội An trong chớp mắt.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl">⛰️</span>
                                <span className="font-mono text-sm font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">15 phút</span>
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-sm mb-1">Sơn Trà & Chùa Linh Ứng</h4>
                            <span className="text-[11px] text-slate-400 block mb-2">Khoảng cách: 10 km</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Trải nghiệm rừng nguyên sinh Sơn Trà, viếng tượng Phật Bà Quán Âm cao nhất Việt Nam nhìn ra toàn cảnh vịnh biển Đà Nẵng.
                            </p>
                        </div>
                    </div>

                    {/* CHAUFFEUR FLEET BANNER */}
                    <div className="mt-8 bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="max-w-xl">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full inline-block mb-2.5">
                                🚘 Đặc quyền đưa đón hạng thương gia
                            </span>
                            <h3 className="font-serif text-2xl font-bold text-slate-900 mb-2">
                                Đội Xe Đưa Đón Riêng Mercedes-Benz & Maybach
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                                Nâng tầm kỳ nghỉ ngay từ giây phút hạ cánh tại sân bay quốc tế Đà Nẵng. Đội xe sang trọng với tài xế chuyên nghiệp túc trực đón tại cửa ra VIP, phục vụ khăn lạnh thảo mộc, nước suối tinh khiết và wifi tốc độ cao xuyên suốt hành trình.
                            </p>
                            <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                                <span className="flex items-center gap-1.5"><span className="text-blue-600 font-bold">✓</span> Mercedes-Benz S-Class 2024</span>
                                <span className="flex items-center gap-1.5"><span className="text-blue-600 font-bold">✓</span> DCar Limousine 9 chỗ VIP</span>
                                <span className="flex items-center gap-1.5"><span className="text-blue-600 font-bold">✓</span> Tài xế giao tiếp Anh - Việt chuẩn mực</span>
                            </div>
                        </div>
                        <div className="w-full lg:w-96 h-52 rounded-2xl overflow-hidden shadow-md shrink-0">
                            <img
                                src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80"
                                alt="Luxury Limousine Chauffeur Service"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. FAQ SECTION */}
            <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Giải đáp nhanh</span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                        Câu Hỏi Thường Gặp Khi Liên Hệ & Lưu Trú
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Các thông tin thiết yếu giúp Quý khách chuẩn bị chu đáo nhất cho chuyến hành trình nghỉ dưỡng tại Đà Nẵng.
                    </p>
                </div>
                <div className="space-y-3">
                    {faqs.map((faq, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition"
                        >
                            <button
                                type="button"
                                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-blue-600 transition"
                            >
                                <span>{faq.q}</span>
                                <span className="text-slate-400 font-bold text-base">
                                    {activeFaq === idx ? '▲' : '▼'}
                                </span>
                            </button>
                            {activeFaq === idx && (
                                <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Reusable Footer */}
            <Footer />
        </div>
    );
}