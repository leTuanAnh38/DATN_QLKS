import React, { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

export default function SpaAndWellnessPage() {
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeFaq, setActiveFaq] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        date: '2026-09-24',
        time: '15:00',
        guests: '1',
        treatment: 'lotus-imperial',
        pressure: 'medium',
        notes: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Treatment Categories
    const categories = [
        { id: 'all', label: 'Tất cả liệu trình' },
        { id: 'body', label: 'Toàn thân' },
        { id: 'facial', label: 'Da mặt chuyên sâu' },
        { id: 'couple', label: 'Cặp đôi' },
        { id: 'detox', label: 'Dưỡng sinh & Thải độc' }
    ];

    // Treatments Data
    const treatments = [
        {
            id: 'lotus-imperial',
            category: 'body',
            badge: 'Bán Chạy Nhất ★',
            badgeColor: 'bg-orange-500',
            duration: '120 Phút',
            title: 'The Lotus Imperial Journey',
            description: 'Hành trình hoàng gia với liệu pháp massage 4 tay đồng bộ kết hợp tẩy tế bào chết hạt sen ngọc trai và ngâm bồn sữa hoa hồng tươi.',
            features: [
                'Tẩy tế bào chết hạt sen ngũ sắc',
                'Massage 4 tay kỹ thuật Lomi Lomi',
                'Ngâm bồn sữa thảo mộc cánh hoa tươi'
            ],
            price: '2.450.000',
            image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 'deep-sea-mineral',
            category: 'body',
            badge: 'Trị Liệu Chuyên Sâu',
            badgeColor: 'bg-blue-600',
            duration: '90 Phút',
            title: 'Deep Sea Mineral Revitalizing',
            description: 'Kỹ thuật ấn huyệt bằng đá bazan núi lửa nóng kết hợp tinh chất khoáng biển sâu giải phóng hoàn toàn các điểm co thắt cơ bắp và mệt mỏi.',
            features: [
                'Khởi động huyệt vị tinh dầu thông đỏ',
                'Trị liệu đá núi lửa nóng 55°C',
                'Thoa serum khoáng biển phục hồi mô cơ'
            ],
            price: '1.850.000',
            image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 'ocean-radiance-facial',
            category: 'facial',
            badge: 'Trẻ Hóa Làn Da',
            badgeColor: 'bg-indigo-600',
            duration: '75 Phút',
            title: 'Ocean Radiance Facial Treatment',
            description: 'Quy trình cấp ẩm tức thì và trẻ hóa làn da với collagen vi sinh từ biển và tinh bột ngọc trai Phú Quốc giúp phục hồi vẻ tươi trẻ rạng ngời.',
            features: [
                'Làm sạch sâu với bọt enzyme hoa quả',
                'Điện di tinh chất ngọc trai và collagen',
                'Massage nâng cơ bằng thanh ngọc bích'
            ],
            price: '1.600.000',
            image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 'honeymoon-serenade',
            category: 'couple',
            badge: 'Dành Cho Cặp Đôi',
            badgeColor: 'bg-rose-500',
            duration: '150 Phút',
            title: 'Honeymoon Ocean Serenade for Couple',
            description: 'Khoảnh khắc gắn kết thăng hoa tại phòng VIP Ocean View riêng biệt: massage nến sáp thơm hoa nhài, ngâm bồn sục hoa hồng tươi kèm 2 ly Champagne.',
            features: [
                'Massage toàn thân bằng nến hữu cơ hoa nhài',
                'Thư giãn bồn sục thủy lực hoa hồng 45 phút',
                'Bánh ngọt macaron & 2 ly vang nổ thượng hạng'
            ],
            price: '4.200.000',
            isHighlight: true,
            image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 'warm-salt-detox',
            category: 'detox',
            badge: 'Thải Độc Năng Lượng',
            badgeColor: 'bg-cyan-600',
            duration: '60 Phút',
            title: 'Himalayan Warm Salt Detox',
            description: 'Liệu pháp thải độc muối hồng ấm nóng kết hợp tinh dầu sả chanh giúp giải tỏa căng cơ cổ vai gáy, kích thích hệ bạch huyết và cải thiện giấc ngủ.',
            features: [
                'Chườm ấm vùng cổ vai gáy bằng túi muối khoáng',
                'Massage trị liệu giải tỏa điểm căng cơ',
                'Thư giãn mắt với túi thảo dược ấm'
            ],
            price: '1.250.000',
            image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 'ayurvedic-head-therapy',
            category: 'detox',
            badge: 'Dưỡng Sinh Cổ Truyền',
            badgeColor: 'bg-amber-600',
            duration: '60 Phút',
            title: 'Ayurvedic Herbal Head Therapy',
            description: 'Gội đầu dưỡng sinh thảo mộc thiên nhiên (bồ kết cô đặc, vỏ bưởi, hà thủ ô) kết hợp ấn huyệt kinh lạc vùng đầu, giải tỏa tức thì cơn đau đầu mãn tính.',
            features: [
                'Rửa mặt & xông hơi tinh chất ngải cứu',
                'Gội đầu thảo dược nấu tươi theo công thức cổ truyền',
                'Ấn huyệt bách hội, phong trì giảm đau nửa đầu'
            ],
            price: '1.100.000',
            image: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=600&q=80'
        }
    ];

    // FAQs Data
    const faqs = [
        {
            q: 'Quý khách cần có mặt trước giờ hẹn bao lâu?',
            a: 'Quý khách nên đến The Lotus Spa trước giờ hẹn khoảng 15 – 20 phút để thưởng thức trà thảo mộc chào mừng, làm bài khảo sát thể trạng ngắn và chuẩn bị thay trang phục xông hơi thư thái.'
        },
        {
            q: 'Chính sách hủy hoặc thay đổi giờ hẹn như thế nào?',
            a: 'Quý khách vui lòng thông báo trước ít nhất 04 tiếng nếu cần đổi giờ hoặc hủy lịch hẹn. Đối với khách lưu trú tại khách sạn, việc hủy trong vòng 2 tiếng có thể áp dụng 50% phí dịch vụ theo quy định.'
        },
        {
            q: 'Phụ nữ mang thai có thể sử dụng các liệu trình spa không?',
            a: 'The Lotus Spa có gói "Maternity Bliss" được thiết kế y khoa chuyên biệt dành cho thai phụ từ tuần thứ 14 trở đi, sử dụng dầu hạt nho hữu cơ và động tác nâng đỡ lưng hông an toàn tuyệt đối.'
        },
        {
            q: 'Tôi không lưu trú tại Khách Sạn TA có thể đặt lịch Spa không?',
            a: 'Hoàn toàn được. The Lotus Spa hân hạnh mở cửa đón tiếp cả khách vãng lai và cư dân địa phương. Quý khách vui lòng đặt hẹn trực tuyến hoặc qua hotline để được chuẩn bị phòng chu đáo nhất.'
        }
    ];

    const filteredTreatments = activeCategory === 'all'
        ? treatments
        : treatments.filter(t => t.category === activeCategory);

    const handleSelectTreatment = (treatmentId) => {
        setFormData({ ...formData, treatment: treatmentId });
        const bookingForm = document.getElementById('dat-lich-form');
        if (bookingForm) {
            bookingForm.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleSubmitBooking = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            alert(`Đã nhận yêu cầu đặt lịch Spa thành công cho Quý khách: ${formData.fullName}! Chuyên viên The Lotus Spa sẽ gọi xác nhận trong vòng 15 phút.`);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">

            {/* Reusable Navbar */}
            <Navbar
                actionText="🌿 Đặt lịch Spa"
                actionLink="#dat-lich-form"
                onActionClick={() => {
                    const el = document.getElementById('dat-lich-form');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
            />


            {/* 3. HERO SPOTLIGHT SECTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm">

                    <div className="lg:col-span-7">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider mb-4">
                            🪷 Ốc đảo tĩnh tại & phục hồi năng lượng ven biển Mỹ Khê
                        </span>
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-3">
                            The Lotus Spa & Wellness
                        </h1>
                        <p className="font-serif text-2xl sm:text-3xl text-blue-600 italic font-medium mb-5">
                            Khơi Nguồn Tinh Hoa Thư Giãn Thượng Lưu
                        </p>
                        <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-8 max-w-xl">
                            Ẩn mình trong khuôn viên biệt lập ven bờ sóng vỗ rì rào bãi biển Mỹ Khê, The Lotus Spa là nơi giao thoa tuyệt mỹ giữa nghệ thuật bấm huyệt cổ truyền Á Đông, tinh dầu thảo dược bản địa thuần khiết và công nghệ thủy trị liệu đạt chuẩn Thụy Sĩ. Hãy thả lỏng tâm trí để giác quan được tái sinh trọn vẹn.
                        </p>

                        <div className="flex flex-wrap gap-4 mb-10">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('dat-lich-form');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
                            >
                                📅 Đặt Lịch Trị Liệu Ngay
                            </button>
                            <a
                                href="#menu-pdf"
                                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl border border-slate-200 transition flex items-center gap-2"
                            >
                                <span>📖</span>
                                <span>Xem Spa Menu PDF</span>
                            </a>
                        </div>

                        {/* 4 Pillars Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
                            <div>
                                <span className="text-xl">🌿</span>
                                <strong className="block text-slate-900 text-sm font-bold mt-1">100%</strong>
                                <span className="text-[11px] text-slate-500">Dược liệu Hữu cơ Tự nhiên</span>
                            </div>
                            <div>
                                <span className="text-xl">🛏️</span>
                                <strong className="block text-slate-900 text-sm font-bold mt-1">12</strong>
                                <span className="text-[11px] text-slate-500">Phòng VIP Ôm Trọn View Biển</span>
                            </div>
                            <div>
                                <span className="text-xl">🎖️</span>
                                <strong className="block text-slate-900 text-sm font-bold mt-1">10+ Năm</strong>
                                <span className="text-[11px] text-slate-500">Master Trị Liệu Quốc Tế</span>
                            </div>
                            <div>
                                <span className="text-xl">🏆</span>
                                <strong className="block text-slate-900 text-sm font-bold mt-1">2024</strong>
                                <span className="text-[11px] text-slate-500">Best Luxury Spa in Asia</span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 relative">
                        <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white h-[420px] sm:h-[480px]">
                            <img
                                src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80"
                                alt="The Lotus Spa Relaxation Lounge"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Overlaid Card */}
                        <div className="absolute -bottom-6 -left-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 max-w-xs hidden sm:flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-lg shrink-0">
                                ✨
                            </div>
                            <div>
                                <strong className="text-xs text-slate-900 font-bold block">Đặc Quyền Hội Viên</strong>
                                <span className="text-[11px] text-slate-500 leading-tight block">Tặng 30 phút trị liệu thủy pháp khi đặt phòng trước</span>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            {/* 4. SPA FACILITIES SECTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                        Tiện nghi biệt lập 5 sao
                    </span>
                    <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-2">
                        Không Gian Trị Liệu & Thư Thái Tối Thượng
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-2">
                        Mỗi góc nhỏ tại The Lotus Spa được tạo tác như một bảo tàng của sự bình yên, ứng dụng nguyên lý cân bằng năng lượng âm dương và triết lý thiên nhiên chữa lành.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Facility 1 */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                        <div className="relative h-44 overflow-hidden">
                            <img
                                src="https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=80"
                                alt="Jacuzzi Nước Biển Ấm"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-blue-900/80 text-white text-[10px] font-bold">
                                Hydrotherapy Pool
                            </span>
                        </div>
                        <div className="p-5">
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                                Bồn Jacuzzi Nước Biển Ấm
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                Hệ thống vòi phun thủy lực đa điểm với nước biển lọc ấm giàu khoáng chất magie, ngắm hoàng hôn rực rỡ buông xuống đại dương.
                            </p>
                            <div className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                                <span>🌡️ Nhiệt độ 36°C - 38°C</span>
                            </div>
                        </div>
                    </div>

                    {/* Facility 2 */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                        <div className="relative h-44 overflow-hidden">
                            <img
                                src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=600&q=80"
                                alt="Xông Hơi Đá Muối Himalaya"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-orange-600/80 text-white text-[10px] font-bold">
                                Himalayan Sauna
                            </span>
                        </div>
                        <div className="p-5">
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                                Xông Hơi Đá Muối Himalaya
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                Bức tường đá muối hồng cổ đại nghìn năm kết hợp tinh dầu tuyết tùng hữu cơ thanh lọc đường hô hấp, đào thải độc tố và xua tan mệt mỏi.
                            </p>
                            <div className="text-[11px] text-orange-600 font-semibold flex items-center gap-1">
                                <span>✨ Liệu pháp ion âm thanh lọc</span>
                            </div>
                        </div>
                    </div>

                    {/* Facility 3 */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                        <div className="relative h-44 overflow-hidden">
                            <img
                                src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80"
                                alt="Tắm Bùn Khoáng Nóng & Tảo Biển"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-700/80 text-white text-[10px] font-bold">
                                Mineral Mud Bath
                            </span>
                        </div>
                        <div className="p-5">
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                                Tắm Bùn Khoáng Nóng & Tảo Biển
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                Bùn khoáng thiên nhiên giàu nguyên tố vi lượng kết hợp chiết xuất tảo lục spirulina giúp tái sinh tế bào biểu bì, làm sáng mịn làn da.
                            </p>
                            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                <span>🌊 Tảo biển sinh học tự nhiên</span>
                            </div>
                        </div>
                    </div>

                    {/* Facility 4 */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                        <div className="relative h-44 overflow-hidden">
                            <img
                                src="https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=600&q=80"
                                alt="Vườn Thiền & Trà Thảo Mộc"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[10px] font-bold">
                                Herbal Tea Lounge
                            </span>
                        </div>
                        <div className="p-5">
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                                Vườn Thiền & Trà Thảo Mộc
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                Khu vực nghỉ ngơi sau liệu trình với các loại trà thảo mộc thượng hạng như hoa cúc tiến vua, trà tim sen Huế, gừng mật ong rừng nguyên chất.
                            </p>
                            <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                                <span>🍵 Trà thảo mộc dưỡng sinh miễn phí</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. SIGNATURE SPA MENU (FILTER + CARDS) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
                    <div>
                        <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                            Danh mục trị liệu đặc biệt
                        </span>
                        <h2 className="font-serif text-3xl font-bold text-slate-900 mt-1">
                            Thực Đơn Liệu Trình Trọng Điểm
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Mỗi gói trị liệu được thiết kế riêng biệt để cân chỉnh năng lượng cơ thể, khơi gợi sinh lực và làm dịu xúc cảm căng thẳng thường nhật.
                        </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeCategory === cat.id
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Treatment Grid (3 Cols) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {filteredTreatments.map((treatment) => (
                        <div
                            key={treatment.id}
                            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                        >
                            <div>
                                <div className="relative h-56 overflow-hidden">
                                    <img
                                        src={treatment.image}
                                        alt={treatment.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />

                                    <span className={`absolute top-3.5 left-3.5 px-3 py-1 rounded-full text-white text-[11px] font-bold shadow-sm ${treatment.badgeColor}`}>
                                        {treatment.badge}
                                    </span>

                                    <span className="absolute bottom-3 right-3 text-[11px] text-white/90 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg">
                                        ⏱️ {treatment.duration}
                                    </span>
                                </div>

                                <div className="p-6">
                                    <h3 className="font-serif font-bold text-slate-900 text-lg group-hover:text-blue-600 transition mb-2">
                                        {treatment.title}
                                    </h3>
                                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                                        {treatment.description}
                                    </p>

                                    <ul className="space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-700 mb-4">
                                        {treatment.features.map((feat, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-blue-600 font-bold">✓</span>
                                                <span className="text-[11px] leading-tight">{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="p-6 pt-0 border-t border-slate-100 mt-2">
                                <div className="flex items-center justify-between pt-4 mb-4">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Giá niêm yết</span>
                                        <span className="text-xl font-bold text-slate-900">{treatment.price} <span className="text-xs text-slate-500 font-normal">VND</span></span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleSelectTreatment(treatment.id)}
                                        className={`px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm ${treatment.isHighlight
                                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25'
                                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                                            }`}
                                    >
                                        {treatment.isHighlight ? 'Đặt Lịch Ngay' : 'Đặt Lịch'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 6. ADVANCE BOOKING PROMO BANNER */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-3 inline-block">
                            ⚡ Ưu đãi đặt trực tuyến độc quyền
                        </span>
                        <h3 className="font-serif text-2xl sm:text-3xl font-bold">
                            Giảm Ngay 20% Khi Đặt Lịch Trực Tuyến Trước 24 Giờ
                        </h3>
                        <p className="text-blue-100 text-xs sm:text-sm mt-2 max-w-xl">
                            Nhận ngay đặc quyền 30 phút trải nghiệm phòng Xông hơi Đá muối Himalaya & Bồn sục Thủy lực Jacuzzi không giới hạn trước khi bắt đầu trị liệu.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                const el = document.getElementById('dat-lich-form');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition"
                        >
                            Nhận Ưu Đãi Ngay
                        </button>
                        <div className="px-4 py-3 bg-white/15 border border-white/20 rounded-xl text-xs font-mono font-bold text-amber-200">
                            Mã: LOTUS20
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. WELLNESS MEMBERSHIP TIERS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                        Hội viên Lotus Club
                    </span>
                    <h2 className="font-serif text-3xl font-bold text-slate-900 mt-1">
                        Đặc Quyền Hội Viên Thượng Lưu
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Dành cho những tâm hồn trân quý sức khỏe thể chất và tìm kiếm năng lượng cân bằng thường kỳ.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Silver Tier */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                                        Gói Tháng
                                    </span>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-2">
                                        Silver Wellness Member
                                    </h3>
                                </div>
                                <span className="text-3xl">🥈</span>
                            </div>

                            <div className="mb-6">
                                <span className="text-3xl font-bold text-blue-600">4.800.000</span>
                                <span className="text-xs text-slate-500 ml-1">VND / Tháng</span>
                            </div>

                            <ul className="space-y-3 text-xs text-slate-600 mb-8 border-t border-slate-100 pt-5">
                                <li className="flex items-center gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>04 buổi trị liệu toàn thân tùy chọn (60 phút/buổi)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>Miễn phí sử dụng Bể sục Jacuzzi & Phòng xông hơi</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>Giảm 15% cho tất cả dịch vụ spa bổ sung</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>Ưu tiên chọn Trị liệu viên Master theo yêu cầu</span>
                                </li>
                            </ul>
                        </div>

                        <button
                            type="button"
                            className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition"
                        >
                            Đăng Ký Hội Viên Silver
                        </button>
                    </div>

                    {/* Diamond Tier */}
                    <div className="bg-gradient-to-b from-slate-900 to-indigo-950 text-white rounded-3xl p-8 shadow-xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/20 px-2.5 py-1 rounded-md">
                                        Gói Năm Thượng Hạng
                                    </span>
                                    <h3 className="font-serif text-2xl font-bold text-white mt-2">
                                        Diamond Oasis Exclusive
                                    </h3>
                                </div>
                                <span className="text-3xl">💎</span>
                            </div>

                            <div className="mb-6">
                                <span className="text-3xl font-bold text-amber-400">42.000.000</span>
                                <span className="text-xs text-slate-300 ml-1">VND / Năm</span>
                            </div>

                            <ul className="space-y-3 text-xs text-slate-200 mb-8 border-t border-white/10 pt-5">
                                <li className="flex items-center gap-2">
                                    <span className="text-amber-400 font-bold">✓</span>
                                    <span>48 buổi trị liệu toàn diện 90 phút không giới hạn thời gian</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-amber-400 font-bold">✓</span>
                                    <span>Miễn phí 02 đêm nghỉ tại phòng Royal Suite view biển</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-amber-400 font-bold">✓</span>
                                    <span>Sử dụng không giới hạn toàn bộ hệ thống Jacuzzi, Sauna, Vườn Thiền</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-amber-400 font-bold">✓</span>
                                    <span>Giảm 25% cho ẩm thực và các dịch vụ phòng tại khách sạn</span>
                                </li>
                            </ul>
                        </div>

                        <button
                            type="button"
                            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg transition"
                        >
                            Đăng Ký Hội Viên Diamond
                        </button>
                    </div>
                </div>
            </section>

            {/* 8. ONLINE BOOKING FORM SECTION */}
            <section id="dat-lich-form" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        <div className="lg:col-span-5">
                            <span className="text-xs uppercase font-bold tracking-widest text-orange-500">
                                Đặt hẹn trực tuyến 24/7
                            </span>
                            <h2 className="font-serif text-3xl font-bold text-slate-900 mt-2 mb-4">
                                Khởi Đầu Hành Trình Phục Hồi Giác Quan
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                                Vui lòng điền thông tin và nguyện vọng trị liệu. Chuyên viên chăm sóc khách hàng của The Lotus Spa sẽ liên hệ xác nhận khung giờ chính xác trong vòng 15 phút.
                            </p>

                            <div className="space-y-4 text-xs">
                                <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl">
                                    <span className="text-blue-600 text-lg">📞</span>
                                    <div>
                                        <strong className="block text-slate-900 font-bold">Hotline Hỗ Trợ Đặt Lịch Nhanh</strong>
                                        <span className="text-slate-500">1900 8899 | +84 (0) 236 388 9900</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl">
                                    <span className="text-orange-500 text-lg">🕒</span>
                                    <div>
                                        <strong className="block text-slate-900 font-bold">Khung Giờ Mở Cửa</strong>
                                        <span className="text-slate-500">Thứ 2 - Chủ Nhật: 09:00 - 22:00 (Đón khách cuối 21:00)</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl">
                                    <span className="text-emerald-600 text-lg">📍</span>
                                    <div>
                                        <strong className="block text-slate-900 font-bold">Vị Trí Trong Khu Nghỉ</strong>
                                        <span className="text-slate-500">Tầng 3 & Vườn Biệt Lập, Khách Sạn TA Đà Nẵng, 08 Võ Nguyên Giáp</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitBooking} className="lg:col-span-7 space-y-4 bg-slate-50/70 p-6 sm:p-8 rounded-2xl border border-slate-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Họ và tên quý khách <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Ví dụ: Nguyễn Hoàng Anh"
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Số điện thoại / Zalo <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="0912 345 678"
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Ngày trị liệu <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Khung giờ (09:00 - 21:00) <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="09:30">09:30 Sáng</option>
                                        <option value="11:00">11:00 Trưa</option>
                                        <option value="14:00">14:00 Chiều</option>
                                        <option value="15:00">15:00 Chiều</option>
                                        <option value="17:00">17:00 Chiều</option>
                                        <option value="19:00">19:00 Tối</option>
                                        <option value="20:30">20:30 Tối</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Số lượng khách
                                    </label>
                                    <select
                                        value={formData.guests}
                                        onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="1">1 Khách (Phòng đơn)</option>
                                        <option value="2">2 Khách (Phòng đôi VIP)</option>
                                        <option value="3">3 - 4 Khách (Phòng gia đình)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Chọn Liệu Trình Trọng Điểm <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.treatment}
                                    onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                                >
                                    <option value="lotus-imperial">The Lotus Imperial Journey (120 phút - 2.450.000 VND)</option>
                                    <option value="deep-sea-mineral">Deep Sea Mineral Revitalizing (90 phút - 1.850.000 VND)</option>
                                    <option value="ocean-radiance">Ocean Radiance Facial Treatment (75 phút - 1.600.000 VND)</option>
                                    <option value="honeymoon-serenade">Honeymoon Ocean Serenade for Couple (150 phút - 4.200.000 VND)</option>
                                    <option value="warm-salt-detox">Himalayan Warm Salt Detox (60 phút - 1.250.000 VND)</option>
                                    <option value="ayurvedic-head">Ayurvedic Herbal Head Therapy (60 phút - 1.100.000 VND)</option>
                                </select>
                            </div>

                            {/* Pressure Preference */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                    Cường độ lực massage mong muốn:
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, pressure: 'soft' })}
                                        className={`py-2 px-3 text-xs rounded-xl border text-center transition ${formData.pressure === 'soft'
                                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        Nhẹ nhàng thư giãn
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, pressure: 'medium' })}
                                        className={`py-2 px-3 text-xs rounded-xl border text-center transition ${formData.pressure === 'medium'
                                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        Vừa phải cân bằng
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, pressure: 'deep' })}
                                        className={`py-2 px-3 text-xs rounded-xl border text-center transition ${formData.pressure === 'deep'
                                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        Chuyên sâu bấm huyệt
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Ghi chú đặc biệt (Dị ứng hương liệu, tiền sử chấn thương, mang thai):
                                </label>
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Ví dụ: Đau mỏi nhiều vùng thắt lưng, muốn chọn kỹ thuật viên nữ, phòng view biển..."
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <span>{isSubmitting ? 'Đang gửi...' : '✓ Xác Nhận Đặt Lịch Trị Liệu Trực Tuyến'}</span>
                                <span>→</span>
                            </button>
                        </form>

                    </div>
                </div>
            </section>

            {/* 9. SPA JOURNEY PROCESS (4 STEPS) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                        Quy trình tiêu chuẩn 5 sao
                    </span>
                    <h2 className="font-serif text-3xl font-bold text-slate-900 mt-1">
                        Hành Trình Trải Nghiệm Chu Đáo
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Mỗi khoảnh khắc tại The Lotus Spa được chăm chút tỉ mỉ từ khi quý khách bước vào đến lúc rời đi trong trạng thái thanh thản an nhiên.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200">
                        <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm mb-4">
                            01
                        </span>
                        <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                            Nghênh Tiếp & Khảo Sát Thể Trạng
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Thưởng thức trà tía sen ướp lạnh, hoàn thiện bảng khảo sát sức khỏe để kỹ thuật viên cá nhân hóa liệu trình thích hợp nhất.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200">
                        <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm mb-4">
                            02
                        </span>
                        <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                            Ngâm Chân Hoa Tươi & Xông Hơi
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Nghi thức ngâm chân muối khoáng thảo dược ấm và 15 phút xông hơi tuyết tùng giúp mở các lỗ chân lông, chuẩn bị đón nhận dưỡng chất.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200">
                        <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm mb-4">
                            03
                        </span>
                        <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                            Liệu Trình Chuyên Biệt Chuyên Nghiệp
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Trị liệu bởi chuyên viên trên 10 năm kinh nghiệm trong tiếng sóng biển và âm nhạc sóng alpha êm dịu dẫn lối giấc ngủ sâu.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200">
                        <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm mb-4">
                            04
                        </span>
                        <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">
                            Thưởng Thức Dưỡng Sinh Bồi Bổ
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Kết thúc hành trình tại Vườn Thiền với món chè hạt sen long nhãn yến sào bồi bổ khí huyết và các loại hạt dinh dưỡng cao cấp.
                        </p>
                    </div>
                </div>
            </section>

            {/* 10. FAQ ACCORDION */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-8">
                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Hỏi đáp thông thường</span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                        Câu Hỏi Thường Gặp (Spa Etiquette & FAQ)
                    </h2>
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