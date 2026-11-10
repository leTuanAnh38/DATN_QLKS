import React from 'react';
import {
    UtensilsCrossed,
    Wine,
    Flower2,
    Car,
    Shirt,
    BellRing,
    Tag
} from 'lucide-react';

export const renderCategoryIcon = (categoryName, iconStr, className = 'w-3.5 h-3.5') => {
    const text = `${categoryName || ''} ${iconStr || ''}`.toLowerCase();
    if (
        text.includes('ẩm thực') ||
        text.includes('ăn') ||
        text.includes('dining') ||
        text.includes('món') ||
        text.includes('bò') ||
        text.includes('súp') ||
        text.includes('phở') ||
        text.includes('fnb') ||
        text.includes('buffet') ||
        text.includes('bếp')
    ) {
        return <UtensilsCrossed className={className} />;
    }
    if (
        text.includes('uống') ||
        text.includes('bar') ||
        text.includes('rượu') ||
        text.includes('trà') ||
        text.includes('cà phê') ||
        text.includes('nước') ||
        text.includes('cocktail') ||
        text.includes('beverage')
    ) {
        return <Wine className={className} />;
    }
    if (
        text.includes('spa') ||
        text.includes('massage') ||
        text.includes('trị liệu') ||
        text.includes('thư giãn') ||
        text.includes('sức khỏe') ||
        text.includes('wellness')
    ) {
        return <Flower2 className={className} />;
    }
    if (
        text.includes('xe') ||
        text.includes('đưa đón') ||
        text.includes('sân bay') ||
        text.includes('tour') ||
        text.includes('du lịch') ||
        text.includes('transport') ||
        text.includes('limousine')
    ) {
        return <Car className={className} />;
    }
    if (text.includes('giặt') || text.includes('ủi') || text.includes('laundry')) {
        return <Shirt className={className} />;
    }
    if (
        text.includes('phòng') ||
        text.includes('buồng') ||
        text.includes('concierge') ||
        text.includes('tiện ích') ||
        text.includes('room')
    ) {
        return <BellRing className={className} />;
    }
    return <Tag className={className} />;
};

export const formatDateTimeDisplay = (isoStr) => {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} • ${date}`;
    } catch {
        return isoStr;
    }
};

export const formatToLocalDateTimeString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const getServiceLabels = (serviceName = '', categoryName = '') => {
    const text = `${categoryName || ''} ${serviceName || ''}`.trim().toLowerCase();

    // 1. Nhóm Đưa đón / Xe
    const transportKeywords = ['sân bay', 'xe', 'đưa đón', 'transfer', 'airport', 'taxi', 'shuttle', 'đón tiễn'];
    if (transportKeywords.some((k) => text.includes(k))) {
        return {
            type: 'transport',
            step1: 'Tiếp nhận',
            step2: 'Điều phối xe',
            step3: 'Xe đang di chuyển',
            step4: 'Hoàn thành chuyến',
            badgePending: 'Chờ xác nhận',
            badgeInProgress: 'Đang điều phối xe',
            badgeDelivering: 'Xe đang đón / di chuyển',
            badgeCompleted: 'Hoàn thành',
            pendingMessage: 'Bộ phận điều vận đã tiếp nhận thông tin và đang kiểm tra lộ trình.',
            inProgressMessage: 'Bộ phận điều vận đang sắp xếp tài xế và xe chuyên dụng cho phòng.',
            deliveringMessage: 'Tài xế và xe đã sẵn sàng phục vụ quý khách tại sảnh / điểm hẹn!',
            completedMessage: 'Chuyến xe đã hoàn thành trọn vẹn. Cảm ơn quý khách đã tin chọn dịch vụ!'
        };
    }

    // 2. Nhóm Spa / Massage
    const spaKeywords = ['spa', 'massage', 'trị liệu', 'xông hơi', 'sauna', 'thư giãn', 'wellness', 'chăm sóc da'];
    if (spaKeywords.some((k) => text.includes(k))) {
        return {
            type: 'spa',
            step1: 'Tiếp nhận',
            step2: 'Chuẩn bị liệu trình',
            step3: 'Đang trị liệu',
            step4: 'Hoàn tất liệu trình',
            badgePending: 'Chờ xác nhận',
            badgeInProgress: 'Chuẩn bị liệu trình',
            badgeDelivering: 'Đang thực hiện trị liệu',
            badgeCompleted: 'Hoàn tất',
            pendingMessage: 'Lễ tân Spa đã nhận yêu cầu và đang kiểm tra phòng trị liệu phù hợp.',
            inProgressMessage: 'Bộ phận Spa đang chuẩn bị dược liệu, phòng xông và kỹ thuật viên.',
            deliveringMessage: 'Kỹ thuật viên và phòng trị liệu đã sẵn sàng đón tiếp quý khách!',
            completedMessage: 'Liệu trình đã hoàn tất. Chúc quý khách những giây phút thư thái trọn vẹn!'
        };
    }

    // 3. Nhóm Tiện ích buồng phòng / Giặt là
    const housekeepingKeywords = ['giặt', 'ủi', 'laundry', 'khăn', 'gối', 'nệm', 'dọn phòng', 'vệ sinh', 'amenity', 'bàn ủi'];
    if (housekeepingKeywords.some((k) => text.includes(k))) {
        return {
            type: 'housekeeping',
            step1: 'Tiếp nhận',
            step2: 'Chuẩn bị đồ dùng',
            step3: 'Đang mang lên phòng',
            step4: 'Đã giao tới phòng',
            badgePending: 'Chờ tiếp nhận',
            badgeInProgress: 'Đang chuẩn bị',
            badgeDelivering: 'Đang mang lên phòng',
            badgeCompleted: 'Đã phục vụ',
            pendingMessage: 'Tổ buồng phòng đã ghi nhận yêu cầu và đang phân công nhân viên phụ trách.',
            inProgressMessage: 'Nhân viên buồng phòng đang chuẩn bị đồ dùng / tiện ích theo yêu cầu.',
            deliveringMessage: 'Nhân viên đang di chuyển mang tiện ích lên tận cửa phòng của quý khách.',
            completedMessage: 'Yêu cầu tiện ích đã được giao hoàn tất. Chúc bạn kỳ nghỉ thoải mái!'
        };
    }

    // 4. Mặc định: Ẩm thực & Thức uống (In-Room Dining)
    return {
        type: 'dining',
        step1: 'Đã nhận đơn',
        step2: 'Bếp đang nấu',
        step3: 'Đang giao tận phòng',
        step4: 'Đã phục vụ',
        badgePending: 'Chờ xác nhận',
        badgeInProgress: 'Bếp đang chuẩn bị',
        badgeDelivering: 'Đang mang lên phòng',
        badgeCompleted: 'Đã giao thành công',
        pendingMessage: 'Yêu cầu đã được chuyển tới bếp & bộ phận F&B chuẩn bị.',
        inProgressMessage: 'Đầu bếp đang chế biến các món ăn nóng hổi, tươi ngon cho phòng.',
        deliveringMessage: 'Nhân viên phục vụ phòng đang mang khay món ăn lên tận cửa phòng của bạn!',
        completedMessage: 'Món ăn đã được phục vụ tận phòng. Chúc quý khách ngon miệng!'
    };
};

