// Dữ liệu chi tiết các hạng phòng & Suites Khách Sạn TA Đà Nẵng

export const ROOMS_DATA = [
    {
        id: 'deluxe-ocean-king',
        numericId: 1,
        name: 'Deluxe Ocean View King',
        category: 'Deluxe Ocean',
        tag: 'ƯU ĐÃI ĐẶC BIỆT',
        tagColor: 'bg-orange-500',
        subTag: 'Tiết kiệm 25%',
        badge: 'Hướng biển 180°',
        rating: 4.92,
        reviewCount: 340,
        floor: 'Tầng 08 - 15',
        tower: 'Tháp Biển San Hô',
        area: '65 m²',
        view: '180° Biển Mỹ Khê',
        bed: '1 Giường King lớn',
        capacity: '2 Người lớn + 1 Trẻ em',
        specs: ['65 m² Không gian', '1 Giường King lớn', 'Bồn tắm sục Marble', 'Ban công riêng hướng vịnh'],
        highlights: [
            'Ban công trực diện biển',
            'Bồn tắm cẩm thạch Ý',
            "Buffet L'Océan mỗi sáng",
            'Nespresso & Trà TWG miễn phí'
        ],
        priceOld: '5.650.000',
        priceCurrent: '4.238.000',
        basePrice: 4238000,
        oldPriceNum: 5650000,
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Phòng Ngay',
        isVilla: false,
        description: 'Không gian tinh khôi hòa quyện kiến trúc duy mỹ với ban công riêng lộng gió biển. Nơi bạn đón những tia nắng bình minh đầu tiên rọi vào phòng ngủ và thư giãn trong bồn tắm cẩm thạch ngắm đại dương bao la.',
        subDescription: 'Được thiết kế tinh tế với gam màu biển cả dịu mát, nội thất gỗ sồi cao cấp và trang thiết bị hiện đại chuẩn 5 sao quốc tế mang đến trải nghiệm nghỉ ngơi trọn vẹn nhất.',
        gallery: [
            {
                id: 1,
                title: 'Góc nhìn chính - Tầm nhìn biển Mỹ Khê',
                url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
                span: 'col-span-12 lg:col-span-6 row-span-2'
            },
            {
                id: 2,
                title: 'Phòng ngủ đệm King êm ái',
                url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 3,
                title: 'Ban công hóng gió biển',
                url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 4,
                title: 'Bồn tắm thư giãn',
                url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 5,
                title: 'Không gian làm việc & thư giãn',
                url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            }
        ]
    },
    {
        id: 'executive-club-suite',
        numericId: 2,
        name: 'Executive Club Seafront Suite',
        category: 'Executive Suite',
        tag: 'BÁN CHẠY NHẤT',
        tagColor: 'bg-blue-600',
        subTag: 'Club Lounge Access',
        badge: 'Khu vực VIP',
        rating: 4.98,
        reviewCount: 512,
        floor: 'Tầng 20 - 24',
        tower: 'Khu vực Executive Club VIP',
        area: '110 m²',
        view: '180° Biển',
        bed: '1 Super King + Sofa',
        capacity: '3 Người lớn',
        specs: ['110 m² (1 Khách + 1 Ngủ)', 'Đặc quyền Executive Lounge', 'Jacuzzi hướng biển ngoài trời', 'Quầy Bar Rượu Vang VIP'],
        highlights: [
            'Đặc quyền TA Club Lounge tầng 25',
            'Tiệc trà chiều & Sunset Cocktail miễn phí',
            'Đưa đón sân bay Đà Nẵng 2 chiều',
            'Giặt ủi 02 món cao cấp mỗi ngày'
        ],
        priceOld: '9.200.000',
        priceCurrent: '7.450.000',
        basePrice: 7450000,
        oldPriceNum: 9200000,
        image: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Phòng Ngay',
        isVilla: false,
        description: 'Nằm kiêu hãnh tại những tầng cao nhất của khách sạn (từ tầng 20 đến 24), Executive Club Seafront Suite là tuyệt tác dành riêng cho những vị khách khao khát không gian nghỉ dưỡng biệt lập, phóng khoáng nhưng đậm chất nghệ thuật. Từng chi tiết nội thất được chế tác thủ công từ gỗ óc chó nguyên khối, đá cẩm thạch Calacatta nhập khẩu Ý, hòa cùng ánh dương vàng rực rỡ len qua hệ kính cong Low-E tràn viền panorama 180°.',
        subDescription: 'Thức giấc giữa tiếng sóng vỗ rì rào của biển Mỹ Khê danh tiếng, thả mình trong bồn tắm sục Jacuzzi kính ngắm đường chân trời vô tận, và tận hưởng trọn vẹn đặc quyền vào phòng chờ VIP TA Executive Club Lounge tại tầng 25 với tiệc trà chiều hoàng gia cùng rượu vang hảo hạng mỗi hoàng hôn.',
        gallery: [
            {
                id: 1,
                title: 'Góc nhìn chính - Tầm nhìn trực diện biển Mỹ Khê 180°',
                url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
                span: 'col-span-12 lg:col-span-6 row-span-2'
            },
            {
                id: 2,
                title: 'Phòng khách sang trọng',
                url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 3,
                title: 'Ban công ngắm hoàng hôn',
                url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 4,
                title: 'Bồn sục Jacuzzi cẩm thạch',
                url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 5,
                title: 'Góc làm việc thượng lưu',
                url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            }
        ]
    },
    {
        id: 'grand-premier-suite',
        numericId: 4,
        name: 'Grand Premier Oceanfront Suite',
        category: 'Executive Suite',
        tag: 'KHÔNG GIAN GIA ĐÌNH VIP',
        tagColor: 'bg-slate-900',
        subTag: '270° Ocean View',
        badge: 'Góc Panorama',
        rating: 4.95,
        reviewCount: 210,
        floor: 'Tầng 16 - 19',
        tower: 'Tháp VIP Crown',
        area: '145 m²',
        view: '270° Panorama Biển & Vịnh',
        bed: '2 Phòng Ngủ VIP',
        capacity: '4 Người lớn + 2 Trẻ em',
        specs: ['145 m² Diện tích', '2 Phòng Ngủ Độc Lập', 'Phòng Khách & Bàn Ăn', 'View Biển Panorama 270°'],
        highlights: [
            'Ban công góc panorama 270°',
            'Quản gia cá nhân riêng hỗ trợ 24/7',
            '60 phút massage toàn thân cho 2 khách',
            'Đưa đón xe Mercedes-Benz E-Class'
        ],
        priceOld: '13.800.000',
        priceCurrent: '11.200.000',
        basePrice: 11200000,
        oldPriceNum: 13800000,
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Phòng Ngay',
        isVilla: false,
        description: 'Căn góc hai mặt biển ngoạn mục với phòng ăn riêng cho 4-6 người và quầy bar cocktail cá nhân hóa. Ban công rộng mở tạo không gian sum họp đầm ấm và riêng tư tuyệt đối cho gia đình thượng lưu.',
        subDescription: 'Sự kết hợp hoàn hảo giữa không gian sinh hoạt chung ấm cúng và các phòng ngủ riêng biệt trang bị tiện nghi xa hoa nhất, đảm bảo kỳ nghỉ đẳng cấp đáng nhớ cho từng thành viên.',
        gallery: [
            {
                id: 1,
                title: 'Phòng khách hướng biển 270°',
                url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
                span: 'col-span-12 lg:col-span-6 row-span-2'
            },
            {
                id: 2,
                title: 'Phòng ngủ Master Suite',
                url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 3,
                title: 'Phòng ngủ phụ cao cấp',
                url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 4,
                title: 'Phòng tắm Master cẩm thạch',
                url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 5,
                title: 'Bàn ăn & quầy cocktail',
                url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            }
        ]
    },
    {
        id: 'presidential-villa',
        numericId: 3,
        name: 'Presidential Beachfront Pool Villa',
        category: 'Presidential Beachfront Villa',
        tag: 'BIỆT THỰ ĐỘC BẢN',
        tagColor: 'bg-amber-600',
        subTag: 'Hồ Bơi Tràn 45m²',
        badge: 'Mặt Biển Riêng Tư',
        rating: 5.0,
        reviewCount: 189,
        floor: 'Dinh thự độc lập mặt biển',
        tower: 'Dinh thự độc lập mặt biển',
        area: '350 m²',
        view: 'Trực diện biển Mỹ Khê riêng tư',
        bed: 'Hồ bơi riêng + 3 Phòng Ngủ',
        capacity: '6 Người lớn + 3 Trẻ em',
        specs: ['Hồ bơi vô cực riêng 45m²', 'Quản gia Butler riêng 24/7', 'Lối đi bãi biển riêng tư', 'Bếp riêng & Đầu bếp cá nhân'],
        highlights: [
            'Đầu bếp tư gia phục vụ tiệc BBQ hải sản',
            'Dịch vụ Butler riêng phục vụ 24/7',
            'Xe Maybach đưa đón tận ga/sân bay',
            'Không gian tiệc cocktail bãi biển tư nhân'
        ],
        priceOld: '22.000.000',
        priceCurrent: '16.800.000',
        basePrice: 16800000,
        oldPriceNum: 22000000,
        image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Biệt Thự',
        isVilla: true,
        description: 'Dinh thự biệt lập trước biển với hồ bơi vô cực riêng 45m², đầu bếp cá nhân và quản gia túc trực 24/7. Lối đi trực tiếp bước ra bãi cát trắng mịn của biển Mỹ Khê, đem lại sự riêng tư tối thượng cho những kỳ nghỉ đẳng cấp hoàng gia.',
        subDescription: 'Trải nghiệm tiệc nướng BBQ hải sản cao cấp ngay tại sân vườn villa với đầu bếp riêng, thưởng thức rượu vang hảo hạng bên hồ bơi tràn bờ dưới ánh hoàng hôn rực rỡ.',
        gallery: [
            {
                id: 1,
                title: 'Hồ bơi tràn bờ biệt lập hướng biển',
                url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
                span: 'col-span-12 lg:col-span-6 row-span-2'
            },
            {
                id: 2,
                title: 'Phòng khách mở nối liền hồ bơi',
                url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 3,
                title: 'Khu vực tắm nắng riêng tư',
                url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 4,
                title: 'Phòng ngủ Master hướng biển',
                url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 5,
                title: 'Bàn ăn tiệc riêng ngoài trời',
                url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            }
        ]
    },
    {
        id: 'sky-penthouse',
        numericId: 5,
        name: 'Sky Royal Penthouse 360°',
        category: 'Sky Royal Penthouse',
        tag: 'ĐỈNH CAO XA HOA',
        tagColor: 'bg-gradient-to-r from-amber-600 to-orange-500',
        subTag: 'Tầng 28 Cao Nhất',
        badge: 'Độc Bản Tầng Thượng',
        rating: 5.0,
        reviewCount: 98,
        floor: 'Tầng 28 (Tầng thượng cao nhất)',
        tower: 'Tháp Sky Tower',
        area: '420 m²',
        view: '360° Toàn Cảnh Vịnh & TP Đà Nẵng',
        bed: 'Sân bay trực thăng + 3 King Beds',
        capacity: '6 Người lớn + 2 Trẻ em',
        specs: ['420 m² Penthouse Đỉnh Cao', 'Hồ Onsen Khoáng Nóng Tầng Thượng', 'Thang Máy Riêng Độc Lập', '02 Quản Gia Riêng 24/7'],
        highlights: [
            'Quầy bar rượu vang và Champagne quý hiếm',
            'Hồ Onsen nước khoáng nóng ngoài trời tầng 28',
            'Bảo vệ chuyên trách & Lối đi thang máy độc lập',
            'Đội ngũ 02 Quản gia và Bếp trưởng thường trực'
        ],
        priceOld: '34.000.000',
        priceCurrent: '28.500.000',
        basePrice: 28500000,
        oldPriceNum: 34000000,
        image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Penthouse',
        isVilla: true,
        description: 'Đỉnh cao xa hoa ngự trị tại tầng thượng 28 với tầm nhìn 360 độ ôm trọn biển Mỹ Khê và toàn cảnh thành phố Đà Nẵng rực rỡ về đêm. Hồ Onsen nước khoáng nóng lộ thiên, quầy bar rượu vang quý hiếm và thang máy riêng bảo mật tuyệt đối.',
        subDescription: 'Biểu tượng của quyền lực và đẳng cấp thượng lưu tột bậc, nơi hội tụ những tiện nghi tinh túy nhất cùng đội ngũ quản gia và đầu bếp phục vụ riêng biệt theo chuẩn dinh thự hoàng gia.',
        gallery: [
            {
                id: 1,
                title: 'Toàn cảnh Penthouse tầng 28 view 360°',
                url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                span: 'col-span-12 lg:col-span-6 row-span-2'
            },
            {
                id: 2,
                title: 'Hồ Onsen khoáng nóng lộ thiên',
                url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 3,
                title: 'Phòng khách vương giả',
                url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 4,
                title: 'Phòng ngủ hoàng gia hướng vịnh',
                url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            },
            {
                id: 5,
                title: 'Quầy rượu vang cao cấp',
                url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
                span: 'col-span-6 lg:col-span-3'
            }
        ]
    }
];

// Hàm tìm kiếm phòng theo id (hỗ trợ slug string id hoặc numeric id)
export function getRoomById(id) {
    if (!id) return ROOMS_DATA[1]; // Mặc định là Executive Club Suite

    const found = ROOMS_DATA.find(
        (room) =>
            room.id.toLowerCase() === String(id).toLowerCase() ||
            String(room.numericId) === String(id)
    );

    return found || ROOMS_DATA[1];
}
