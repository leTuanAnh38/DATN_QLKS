import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    X,
    RotateCcw,
    Send,
    Sparkles,
    Bot,
    ChevronDown,
    BedDouble,
    Utensils,
    CalendarCheck,
    Eye,
    FileText,
    CheckCircle2,
    Key,
    CheckCheck,
    AlertCircle,
    Phone,
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    Compass,
    Receipt,
    Wifi,
    Gift,
    Copy,
    Check,
    Calendar
} from 'lucide-react';
import { askChatbot } from '../../services/chatbotService';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { useAuth } from '../../store/authStore';

const STORAGE_KEY = 'ta_hotel_ai_chat_history_v5';

// Bảng mã ngôn ngữ cho Web Speech API (STT & TTS)
const SPEECH_LANG_MAP = {
    vi: 'vi-VN',
    en: 'en-US',
    ko: 'ko-KR',
    zh: 'zh-CN'
};

// Hàm làm sạch văn bản trước khi đọc bằng Text-to-Speech (bỏ markdown, bảng, url, icon thừa)
function cleanTextForSpeech(text) {
    if (!text) return '';
    return text
        .replace(/\|.*\|/g, ' ') // Bỏ dòng bảng markdown
        .replace(/[*_#`~]/g, '') // Bỏ ký tự markdown
        .replace(/https?:\/\/\S+/g, '') // Bỏ đường link URL
        .replace(/[•\-+]\s+/g, ', ') // Thay bullet point thành dấu phẩy ngắt giọng tự nhiên
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const SUPPORTED_LANGS = [
    { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'ko', flag: '🇰🇷', label: '한국어' },
    { code: 'zh', flag: '🇨🇳', label: '中文' }
];

const getWelcomeMessages = (stars = 5, hotelName = 'Khách Sạn TA Đà Nẵng') => ({
    vi: `Dạ em kính chào Quý khách! Em là Trợ lý ảo AI Concierge của **${hotelName} ${stars}★**.\n\nEm luôn sẵn sàng hỗ trợ Quý khách 24/7:\n• **Kiểm tra phòng trống thực tế theo ngày & So sánh giá**\n• **Thực đơn Ẩm thực tại phòng, Ocean Spa & Xe Limousine đón sân bay**\n• **Tư vấn lịch trình Du lịch Đà Nẵng – Hội An – Bà Nà Hills**\n• **Trợ lý lưu trú: Hóa đơn tạm tính, Wifi, gọi dọn phòng 1 chạm**\n\nQuý khách có thể bấm nhanh các gợi ý bên dưới hoặc gửi tin nhắn cho em nhé ạ!`,
    en: `Dear Valued Guest! I am your ${stars}-Star AI Concierge at **${hotelName}**.\n\nI am at your service 24/7 to assist with:\n• **Date-Specific Room Availability & Rates (with USD conversion)**\n• **Fine Dining Menus, Ocean Spa & Private Airport Limousine**\n• **Da Nang – Hoi An – Ba Na Hills Sightseeing Itinerary**\n• **In-House Concierge: Live Folio Bill, Wi-Fi & Housekeeping**\n\nPlease select one of the quick suggestions below or send me your inquiry!`,
    ko: `고객님 안녕하십니까! **${hotelName} ${stars}성급 호텔 & 리조트**의 AI 컨시어지입니다.\n\n고객님의 완벽한 휴식을 위해 24시간 맞춤 안내를 제공합니다:\n• **날짜별 실시간 잔여 객실 및 1박 요금 (KRW 원화 자동 환산)**\n• **인룸 다이닝 메뉴, 오션 스파 & 다낭 공항 리무진 픽업**\n• **다낭 · 호이안 · 바나힐 핵심 관광 코스 안내**\n• **투숙객 전용: 실시간 중간 정산서, 와이파이 및 객실 청소 요청**\n\n아래 빠른 질문 버튼을 누르시거나 언제든 편하게 질문해 주세요!`,
    zh: `尊敬的贵宾，您好！我是**${hotelName} ${stars}星级度假酒店**的专属AI礼宾顾问。\n\n我将24小时竭诚为您提供服务：\n• **按日期查询实时空房与优惠房价（人民币CNY自动换算）**\n• **客房送餐菜单、海景水疗SPA与豪华专车接送机**\n• **岘港 · 会安 · 巴拿山精选旅游攻略**\n• **在住贵宾服务：实时账单查询、Wi-Fi密码与一键客房清洁**\n\n您可以点击下方快捷问题或直接输入您的需求！`
});

const QUICK_CHIPS_BY_LANG = {
    vi: [
        { id: 'rooms_tomorrow', label: 'Tìm phòng trống ngày mai', icon: BedDouble, query: 'Ngày mai còn phòng trống không và bảng giá thế nào?' },
        { id: 'services_dining', label: 'Bảng giá Spa & Ẩm thực', icon: Utensils, query: 'Cho tôi xem bảng giá dịch vụ Spa, Ẩm thực tại phòng và Xe đưa đón sân bay' },
        { id: 'danang_tour', label: 'Du lịch Đà Nẵng & Xe VIP', icon: Compass, query: 'Gợi ý lịch trình tham quan Đà Nẵng, Cầu Rồng phun lửa và dịch vụ xe đưa đón VIP' },
        { id: 'vouchers_vip', label: 'Ưu đãi & Mã giảm giá', icon: Gift, query: 'Khách sạn đang có những mã giảm giá Voucher và ưu đãi thẻ thành viên VIP nào?' },
        { id: 'inhouse_bill', label: 'Hóa đơn tạm tính & Đơn phòng', icon: Receipt, query: 'Kiểm tra hóa đơn tạm tính và tiến trình đơn đặt phòng của tôi' },
        { id: 'policy_wifi', label: 'Chính sách Nhận/Trả & Wifi', icon: Wifi, query: 'Cho tôi xin giờ nhận/trả phòng tiêu chuẩn, giờ mở cửa hồ bơi và mật khẩu Wifi' }
    ],
    en: [
        { id: 'rooms_tomorrow', label: 'Rooms Available Tomorrow', icon: BedDouble, query: 'What rooms are available tomorrow and what are the rates in USD?' },
        { id: 'services_dining', label: 'Dining, Spa & Limousine', icon: Utensils, query: 'What dining, Ocean Spa and airport transfer services do you offer?' },
        { id: 'danang_tour', label: 'Da Nang Guide & Shuttle', icon: Compass, query: 'Recommend Da Nang sightseeing itinerary (Dragon Bridge, Ba Na Hills, Hoi An) and VIP car service.' },
        { id: 'vouchers_vip', label: 'Promo Codes & VIP Perks', icon: Gift, query: 'What active promotional codes and VIP membership discounts are available?' },
        { id: 'inhouse_bill', label: 'Track Booking & Live Bill', icon: Receipt, query: 'Check my booking reservation status and current provisional bill' },
        { id: 'policy_wifi', label: 'Check-in Policy & Wi-Fi', icon: Wifi, query: 'What are the check-in/out hours, pool hours and Wi-Fi password?' }
    ],
    ko: [
        { id: 'rooms_tomorrow', label: '내일 예약 가능 객실 (KRW)', icon: BedDouble, query: '내일 이용 가능한 객실과 1박 요금(KRW 원화)을 알려주세요.' },
        { id: 'services_dining', label: '스파 · 다이닝 & 공항 픽업', icon: Utensils, query: '호텔의 인룸 다이닝, 스파 및 다낭 공항 리무진 픽업 서비스 안내해 주세요.' },
        { id: 'danang_tour', label: '다낭 관광 코스 & VIP 차량', icon: Compass, query: '다낭 주요 관광지(용다리 불쇼, 바나힐, 호이안) 코스와 호텔 VIP 차량 서비스 알려주세요.' },
        { id: 'vouchers_vip', label: '할인 코드 & 멤버십 혜택', icon: Gift, query: '현재 사용 가능한 프로모션 할인 코드와 VIP 멤버십 혜택이 어떻게 되나요?' },
        { id: 'inhouse_bill', label: '내 예약 및 실시간 요금 조회', icon: Receipt, query: '내 예약 내역 확인해 줘' },
        { id: 'policy_wifi', label: '체크인 시간 · 수영장 & 와이파이', icon: Wifi, query: '체크인/체크아웃 시간과 수영장 운영 시간, 와이파이 비밀번호 알려주세요.' }
    ],
    zh: [
        { id: 'rooms_tomorrow', label: '明日空房与房价 (CNY)', icon: BedDouble, query: '请问明天有哪些空房和房价（人民币换算）？' },
        { id: 'services_dining', label: '餐饮美食、SPA与接送机', icon: Utensils, query: '请介绍酒店的餐饮服务、SPA水疗及岘港机场接送服务。' },
        { id: 'danang_tour', label: '岘港旅游攻略与贵宾专车', icon: Compass, query: '推荐岘港必去景点（龙桥喷火、巴拿山、会安古镇）及酒店豪华专车服务。' },
        { id: 'vouchers_vip', label: '优惠码与VIP会员礼遇', icon: Gift, query: '请问目前有哪些可用优惠码和会员折扣？' },
        { id: 'inhouse_bill', label: '预订进度与实时账单查询', icon: Receipt, query: '查询我的客房预订订单状态' },
        { id: 'policy_wifi', label: '入住政策、泳池与Wi-Fi', icon: Wifi, query: '请问入住退房时间、无边泳池开放时间及Wi-Fi密码？' }
    ]
};

const I18N_DICT = {
    vi: {
        quick_title: 'Gợi ý hỏi nhanh 1 chạm:',
        rooms_title: 'Phòng gợi ý & Bảng giá theo lịch:',
        swipe_hint: 'Vuốt sang để xem thêm →',
        avail_rooms: (n) => `Còn ${n} phòng`,
        sold_out: 'Tạm hết phòng',
        luxury_tag: 'Đặc Quyền VIP',
        max_guests: (b, c) => `${b} • Tối đa ${c} khách`,
        price_from: 'Giá từ:',
        per_night: ' /đêm',
        view_details: 'Chi tiết',
        book_now: 'Đặt ngay',
        services_title: 'Dịch vụ Ẩm thực, Spa & Xe Đưa Đón:',
        service_price: 'Giá dịch vụ:',
        view_menu_order: 'Đặt dịch vụ này',
        booking_title: 'Tiến trình đơn đặt phòng thời gian thực:',
        found_count: (n) => `Tìm thấy ${n} đơn đặt phòng`,
        room_category: 'Hạng phòng:',
        guest_name: 'Khách hàng:',
        stay_dates: 'Thời gian:',
        total_payment: 'Tổng thanh toán:',
        step_reserved: 'Giữ chỗ',
        step_confirmed: 'Xác nhận',
        step_stay: 'Đang ở',
        step_done: 'Hoàn tất',
        cancelled_warning: 'Đơn đặt phòng này đã bị hủy. Quý khách vui lòng liên hệ lễ tân để được hỗ trợ.',
        booking_history: 'Lịch sử đặt',
        hotline_call: 'Lễ tân +84 1900 8899',
        input_placeholder: 'Hỏi phòng trống ngày mai, hóa đơn phòng, Cầu Rồng, đặt xe...',
        typing_indicator: 'Trợ lý đang tra cứu số liệu...',
        instant_response: 'Phản hồi tức thì 24/7',
        speak_btn: 'Nghe đọc',
        stop_speak: 'Dừng đọc',
        voice_listening: 'Đang lắng nghe... Hãy nói câu hỏi',
        voice_stop: 'Dừng',
        voice_not_supported: 'Trình duyệt không hỗ trợ nhận diện giọng nói. Quý khách vui lòng dùng Chrome hoặc Edge.',
        voice_denied: 'Microphone chưa được cấp quyền truy cập.',
        inhouse_badge: (room) => `Đang lưu trú: Phòng P.${room}`,
        btn_folio: 'Hóa đơn tạm tính',
        btn_clean: 'Gọi dọn phòng',
        copy_btn: 'Sao chép',
        copied_btn: 'Đã sao chép'
    },
    en: {
        quick_title: 'Quick 1-Tap Suggestions:',
        rooms_title: 'Recommended Rooms & Rates:',
        swipe_hint: 'Swipe to view more →',
        avail_rooms: (n) => `${n} rooms left`,
        sold_out: 'Fully booked',
        luxury_tag: 'VIP Luxury',
        max_guests: (b, c) => `${b} • Up to ${c} guests`,
        price_from: 'From:',
        per_night: ' /night',
        view_details: 'Details',
        book_now: 'Book Now',
        services_title: 'Featured Dining, Spa & Transfers:',
        service_price: 'Price:',
        view_menu_order: 'Order This Service',
        booking_title: 'Real-Time Booking Progress Tracker:',
        found_count: (n) => `${n} bookings found`,
        room_category: 'Room:',
        guest_name: 'Guest:',
        stay_dates: 'Stay:',
        total_payment: 'Total Amount:',
        step_reserved: 'Reserved',
        step_confirmed: 'Confirmed',
        step_stay: 'In-House',
        step_done: 'Completed',
        cancelled_warning: 'This reservation has been cancelled. Please contact concierge for assistance.',
        booking_history: 'My Bookings',
        hotline_call: 'Concierge +84 1900 8899',
        input_placeholder: 'Ask about tomorrow rooms, live bill, Dragon Bridge, airport car...',
        typing_indicator: 'AI Concierge is fetching real-time data...',
        instant_response: 'Instant 24/7 Response',
        speak_btn: 'Listen',
        stop_speak: 'Stop',
        voice_listening: 'Listening... Speak your question now',
        voice_stop: 'Stop',
        voice_not_supported: 'Speech recognition is not supported in this browser.',
        voice_denied: 'Microphone access was denied.',
        inhouse_badge: (room) => `In-House: Room P.${room}`,
        btn_folio: 'Live Bill',
        btn_clean: 'Make Up Room',
        copy_btn: 'Copy',
        copied_btn: 'Copied'
    },
    ko: {
        quick_title: '빠른 1-터치 추천 질문:',
        rooms_title: '추천 맞춤 객실 및 요금:',
        swipe_hint: '옆으로 스크롤하여 더보기 →',
        avail_rooms: (n) => `${n}개 객실 남음`,
        sold_out: '예약 마감',
        luxury_tag: 'VIP 럭셔리',
        max_guests: (b, c) => `${b} • 최대 ${c}인`,
        price_from: '최저 요금:',
        per_night: ' /1박',
        view_details: '상세보기',
        book_now: '지금 예약',
        services_title: '주요 다이닝 & 편의 서비스:',
        service_price: '이용 요금:',
        view_menu_order: '메뉴 보기 & 주문',
        booking_title: '실시간 예약 진행 현황:',
        found_count: (n) => `${n}건의 예약 발견`,
        room_category: '배정 객실:',
        guest_name: '투숙객:',
        stay_dates: '투숙 기간:',
        total_payment: '총 결제금액:',
        step_reserved: '예약접수',
        step_confirmed: '확정완료',
        step_stay: '투숙중',
        step_done: '이용완료',
        cancelled_warning: '취소된 예약 내역입니다.',
        booking_history: '예약 내역',
        hotline_call: '핫라인 +84 1900 8899',
        input_placeholder: '내일 객실 요금, 다이닝, 공항 픽업, 예약 상태 질문...',
        typing_indicator: 'AI 컨시어지가 데이터를 조회 중입니다...',
        instant_response: '24시간 연중무휴 즉시 응답',
        speak_btn: '음성 듣기',
        stop_speak: '듣기 중지',
        voice_listening: '음성을 듣고 있습니다...',
        voice_stop: '중지',
        voice_not_supported: '현재 브라우저는 음성 인식을 지원하지 않습니다.',
        voice_denied: '마이크 사용 권한이 거부되었습니다.',
        inhouse_badge: (room) => `투숙 중: ${room}호`,
        btn_folio: '실시간 정산서',
        btn_clean: '객실 청소',
        copy_btn: '복사',
        copied_btn: '복사완료'
    },
    zh: {
        quick_title: '快捷一键提问推荐:',
        rooms_title: '精选推荐客房与参考房价:',
        swipe_hint: '向右滑动查看更多 →',
        avail_rooms: (n) => `剩余 ${n} 间空房`,
        sold_out: '线上已售罄',
        luxury_tag: 'VIP奢华',
        max_guests: (b, c) => `${b} • 最多容纳 ${c} 人`,
        price_from: '起拍价:',
        per_night: ' /晚',
        view_details: '查看详情',
        book_now: '立即预订',
        services_title: '精选餐饮美食与高端礼宾:',
        service_price: '服务费用:',
        view_menu_order: '查看菜单与点餐',
        booking_title: '实时预订进度追踪:',
        found_count: (n) => `查到 ${n} 笔预订`,
        room_category: '客房房型:',
        guest_name: '入住贵宾:',
        stay_dates: '入住日期:',
        total_payment: '订单总额:',
        step_reserved: '已占房',
        step_confirmed: '已确认',
        step_stay: '在住中',
        step_done: '已完成',
        cancelled_warning: '该订单已取消。如需咨询请联系前台礼宾部。',
        booking_history: '预订记录',
        hotline_call: '礼宾热线 +84 1900 8899',
        input_placeholder: '咨询明日房价、特色餐饮、订单查询...',
        typing_indicator: 'AI礼宾专员正在查询最新系统数据...',
        instant_response: '24小时极速即时回复',
        speak_btn: '语音朗读',
        stop_speak: '停止朗读',
        voice_listening: '正在聆听... 请说出您的问题',
        voice_stop: '停止',
        voice_not_supported: '当前浏览器不支持语音识别。',
        voice_denied: '麦克风权限已被拒绝。',
        inhouse_badge: (room) => `在住贵宾: ${room}号房`,
        btn_folio: '实时账单',
        btn_clean: '打扫房间',
        copy_btn: '复制',
        copied_btn: '已复制'
    }
};

/**
 * Hàm phân giải Inline Markdown (in đậm **text**, mã code `code`, in nghiêng *text*)
 */
function renderInlineMarkdown(text) {
    if (!text) return null;
    const tokens = text.split(/(\*\*.*?\*\*|`[^`]+`|\*[^*\s][^*]*?\*)/g);
    return tokens.map((tok, idx) => {
        if (!tok) return null;
        if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
            return (
                <strong key={idx} className="font-semibold text-slate-900">
                    {tok.slice(2, -2)}
                </strong>
            );
        }
        if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
            return (
                <code
                    key={idx}
                    className="px-1.5 py-0.5 mx-0.5 rounded bg-amber-50 text-amber-800 font-mono text-[11px] font-bold border border-amber-200"
                >
                    {tok.slice(1, -1)}
                </code>
            );
        }
        if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
            return (
                <em key={idx} className="italic text-slate-600">
                    {tok.slice(1, -1)}
                </em>
            );
        }
        return <React.Fragment key={idx}>{tok}</React.Fragment>;
    });
}

/**
 * Bộ phân giải Rich Markdown tông sáng dịu mắt:
 * - Hỗ trợ Bảng so sánh phòng/dịch vụ (Markdown Table | ... |)
 * - Hỗ trợ Tiêu đề (###, ##, #) không còn hiện ký tự thô
 * - Hỗ trợ Danh sách chấm tròn (•, -, +) và Danh sách đánh số (1., 2.)
 */
function renderFormattedContent(text) {
    if (!text) return null;

    const lines = text.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. Kiểm tra nếu là Bảng Markdown (bắt đầu và kết thúc bằng dấu |)
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }

            if (tableLines.length >= 2) {
                const parseRow = (rStr) =>
                    rStr
                        .slice(1, -1)
                        .split('|')
                        .map((c) => c.trim());

                const headerCells = parseRow(tableLines[0]);
                const isSeparator = (rStr) => /^[\s|:-]+$/.test(rStr);
                const bodyStartIdx = isSeparator(tableLines[1]) ? 2 : 1;
                const bodyRows = tableLines.slice(bodyStartIdx).filter((r) => !isSeparator(r)).map(parseRow);

                blocks.push(
                    <div
                        key={`tbl-${i}`}
                        className="my-2.5 overflow-x-auto rounded-xl border border-sky-200/90 shadow-2xs bg-white"
                    >
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-sky-50/95 text-sky-900 border-b border-sky-200/80">
                                    {headerCells.map((hCell, hIdx) => (
                                        <th key={hIdx} className="py-2 px-2.5 font-bold whitespace-nowrap">
                                            {hCell.replace(/\*\*/g, '')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bodyRows.map((row, rIdx) => (
                                    <tr
                                        key={rIdx}
                                        className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                                    >
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="py-2 px-2.5 text-slate-700 align-top">
                                                {renderInlineMarkdown(cell)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                continue;
            }
        }

        // 2. Dòng trống
        if (!trimmed) {
            blocks.push(<div key={`sp-${i}`} className="h-1.5" />);
            i++;
            continue;
        }

        // 3. Tiêu đề Markdown (###, ##, #)
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
            const titleContent = headingMatch[2];
            blocks.push(
                <div
                    key={`hd-${i}`}
                    className="mt-2.5 mb-1.5 pb-1 border-b border-sky-100 font-bold text-slate-800 text-xs sm:text-[13px] flex items-center gap-1.5"
                >
                    <span className="w-1 h-3.5 rounded-full bg-sky-500 inline-block flex-shrink-0" />
                    <span>{renderInlineMarkdown(titleContent)}</span>
                </div>
            );
            i++;
            continue;
        }

        // 4. Danh sách thụt lề cấp 2 (  + hoặc   *)
        if (/^\s{2,}[+*•-]\s+/.test(line)) {
            const subContent = trimmed.replace(/^[+*•-]\s+/, '');
            blocks.push(
                <div key={`sub-${i}`} className="pl-4 my-0.5 text-slate-600 text-[11.5px] leading-relaxed flex items-start gap-1.5">
                    <span className="text-sky-600 font-bold mt-0.5">◦</span>
                    <div className="flex-1">{renderInlineMarkdown(subContent)}</div>
                </div>
            );
            i++;
            continue;
        }

        // 5. Danh sách Bullet chính (•, -, *, +)
        if (/^[•\-+]\s+/.test(trimmed)) {
            const bulletContent = trimmed.replace(/^[•\-+]\s+/, '');
            blocks.push(
                <div key={`bl-${i}`} className="pl-1 my-0.5 text-slate-700 leading-relaxed flex items-start gap-1.5">
                    <span className="text-sky-600 font-bold mt-0.5">•</span>
                    <div className="flex-1">{renderInlineMarkdown(bulletContent)}</div>
                </div>
            );
            i++;
            continue;
        }

        // 6. Danh sách đánh số (1. , 2. )
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
            blocks.push(
                <div key={`nm-${i}`} className="pl-1 my-1 text-slate-700 leading-relaxed flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {numMatch[1]}
                    </span>
                    <div className="flex-1">{renderInlineMarkdown(numMatch[2])}</div>
                </div>
            );
            i++;
            continue;
        }

        // 7. Đoạn văn thông thường
        blocks.push(
            <div key={`p-${i}`} className="my-1 text-slate-700 leading-relaxed">
                {renderInlineMarkdown(line)}
            </div>
        );
        i++;
    }

    return blocks;
}

export default function AIChatbotWidget() {
    const navigate = useNavigate();
    const location = useLocation();
    const hasMobileStickyBar =
        location.pathname.startsWith('/rooms/') ||
        location.pathname.startsWith('/room/') ||
        location.pathname.startsWith('/checkout');

    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const welcomeMessages = getWelcomeMessages(starCount, hotelName);

    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showCalloutBubble, setShowCalloutBubble] = useState(false);
    const [selectedLang, setSelectedLang] = useState('vi');
    const [activeStayInfo, setActiveStayInfo] = useState(null);

    // Khởi tạo lịch sử chat từ sessionStorage hoặc localStorage
    const [messages, setMessages] = useState(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Lỗi đọc chat history:', e);
        }
        return [
            {
                id: 'welcome-1',
                role: 'model',
                detected_lang: 'vi',
                text: welcomeMessages.vi,
                time: 'Bây giờ'
            }
        ];
    });

    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showLangDropdown, setShowLangDropdown] = useState(false);

    // Tự động hiển thị Bong bóng chào đón thông minh (Proactive Callout Bubble) sau 3.5s
    useEffect(() => {
        let hasDismissed = false;
        try {
            hasDismissed = sessionStorage.getItem('ta_chatbot_bubble_dismissed') === 'true';
        } catch {
            // ignore
        }
        if (hasDismissed) return;

        const timer = setTimeout(() => {
            if (!isOpen) {
                setShowCalloutBubble(true);
            }
        }, 3500);

        return () => clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setShowCalloutBubble(false);
        }
    }, [isOpen]);

    const handleDismissBubble = (e) => {
        e.stopPropagation();
        setShowCalloutBubble(false);
        try {
            sessionStorage.setItem('ta_chatbot_bubble_dismissed', 'true');
        } catch {
            // ignore
        }
    };

    // Voice AI States (Web Speech API: STT & TTS)
    const [speakingMsgId, setSpeakingMsgId] = useState(null);
    const [copiedMsgId, setCopiedMsgId] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [voiceError, setVoiceError] = useState(null);
    const [availableVoices, setAvailableVoices] = useState([]);

    const chatContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const langDropdownRef = useRef(null);
    const recognitionRef = useRef(null);

    // Lắng nghe phím Escape để đóng nhanh khung chat
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Khóa cuộn trang nền khi mở chatbot toàn màn hình trên điện thoại
    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    // Sao chép nội dung tin nhắn 1 chạm
    const handleCopyMessage = async (msg) => {
        if (!msg || !msg.text) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(msg.text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = msg.text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            setCopiedMsgId(msg.id);
            setTimeout(() => setCopiedMsgId((curr) => (curr === msg.id ? null : curr)), 2000);
        } catch (err) {
            console.warn('Lỗi sao chép tin nhắn:', err);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const updateVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices && voices.length > 0) {
                    setAvailableVoices(voices);
                }
            };
            updateVoices();
            window.speechSynthesis.onvoiceschanged = updateVoices;
            return () => {
                window.speechSynthesis.onvoiceschanged = null;
            };
        }
    }, []);

    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {
                    // ignore
                }
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                setSpeakingMsgId(null);
            }
            if (recognitionRef.current && isListening) {
                try {
                    recognitionRef.current.stop();
                } catch {
                    // ignore
                }
                setIsListening(false);
            }
        }
    }, [isOpen, isListening]);

    const toggleSpeakMessage = (msg) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            const dict = I18N_DICT[selectedLang] || I18N_DICT.vi;
            setVoiceError(dict.voice_not_supported);
            setTimeout(() => setVoiceError(null), 4000);
            return;
        }

        if (speakingMsgId === msg.id) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
            return;
        }

        window.speechSynthesis.cancel();
        const cleanedText = cleanTextForSpeech(msg.text);
        if (!cleanedText) return;

        const utterance = new SpeechSynthesisUtterance(cleanedText);
        const targetLang = msg.detected_lang || selectedLang || 'vi';
        const targetLangCode = SPEECH_LANG_MAP[targetLang] || 'vi-VN';
        utterance.lang = targetLangCode;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
            const matchedVoice =
                voices.find((v) => v.lang.toLowerCase().replace('_', '-') === targetLangCode.toLowerCase()) ||
                voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.toLowerCase())) ||
                voices.find((v) => v.lang.toLowerCase().startsWith(targetLangCode.slice(0, 2).toLowerCase()));
            if (matchedVoice) {
                utterance.voice = matchedVoice;
            }
        }

        utterance.onstart = () => setSpeakingMsgId(msg.id);
        utterance.onend = () => setSpeakingMsgId(null);
        utterance.onerror = () => setSpeakingMsgId(null);

        window.speechSynthesis.speak(utterance);
    };

    const toggleVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            const dict = I18N_DICT[selectedLang] || I18N_DICT.vi;
            setVoiceError(dict.voice_not_supported);
            setTimeout(() => setVoiceError(null), 4000);
            return;
        }

        if (isListening && recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {
                // ignore
            }
            setIsListening(false);
            return;
        }

        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
        }

        try {
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            const targetLangCode = SPEECH_LANG_MAP[selectedLang] || 'vi-VN';
            recognition.lang = targetLangCode;
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                setIsListening(true);
                setVoiceError(null);
            };

            recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const speechResult = finalTranscript || interimTranscript;
                if (speechResult) {
                    setInputValue(speechResult);
                }
            };

            recognition.onerror = (event) => {
                setIsListening(false);
                const dict = I18N_DICT[selectedLang] || I18N_DICT.vi;
                if (event.error === 'not-allowed') {
                    setVoiceError(dict.voice_denied);
                    setTimeout(() => setVoiceError(null), 4000);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
        } catch {
            setIsListening(false);
        }
    };

    useEffect(() => {
        function handleClickOutside(e) {
            if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
                setShowLangDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const scrollToBottom = (smooth = true) => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        } else if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
        }
    };

    const scrollToTop = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = 0;
        }
    };

    /**
     * Cuộn thông minh đến đầu lượt tương tác gần nhất:
     * Thay vì tụt xuống đáy danh sách các thẻ cards, hàm này cuộn chuẩn xác
     * đến câu hỏi của khách hoặc đầu câu trả lời của AI để khách đọc giải thích ngay từ dòng đầu tiên!
     */
    const scrollToLastInteraction = (smooth = true) => {
        if (!chatContainerRef.current || messages.length <= 1) {
            scrollToTop();
            return;
        }
        const lastMsg = messages[messages.length - 1];
        const prevMsg = messages.length >= 2 ? messages[messages.length - 2] : null;

        const targetId = (lastMsg?.role === 'model' && prevMsg?.role === 'user')
            ? `chat-msg-${prevMsg.id}`
            : `chat-msg-${lastMsg?.id}`;

        const container = chatContainerRef.current;
        let targetEl = document.getElementById(targetId) || (lastMsg ? document.getElementById(`chat-msg-${lastMsg.id}`) : null);

        if (targetEl && container) {
            const containerRect = container.getBoundingClientRect();
            const elRect = targetEl.getBoundingClientRect();

            // Nếu câu hỏi của khách quá dài (> 120px), cuộn trực tiếp tới đầu câu trả lời của bot
            if (targetId.startsWith('chat-msg-user-') && elRect.height > 120) {
                const botEl = document.getElementById(`chat-msg-${lastMsg.id}`);
                if (botEl) {
                    targetEl = botEl;
                }
            }

            const updatedElRect = targetEl.getBoundingClientRect();
            const relativeTop = updatedElRect.top - containerRect.top + container.scrollTop;
            const targetTop = Math.max(0, relativeTop - 10);

            container.scrollTo({
                top: targetTop,
                behavior: smooth ? 'smooth' : 'auto'
            });
        } else {
            scrollToBottom(smooth);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setHasUnread(false);
            if (messages.length <= 1) {
                scrollToTop();
                requestAnimationFrame(() => scrollToTop());
                setTimeout(() => scrollToTop(), 50);
            } else {
                requestAnimationFrame(() => {
                    scrollToLastInteraction(false);
                    setTimeout(() => scrollToLastInteraction(false), 50);
                });
            }
            setTimeout(() => {
                inputRef.current?.focus({ preventScroll: true });
            }, 100);
        }
    }, [isOpen]);

    useEffect(() => {
        try {
            const serialized = JSON.stringify(messages.slice(-30));
            sessionStorage.setItem(STORAGE_KEY, serialized);
            localStorage.setItem(STORAGE_KEY, serialized);
        } catch (e) {
            console.error('Lỗi ghi chat history:', e);
        }

        if (isOpen) {
            if (messages.length <= 1) {
                scrollToTop();
                requestAnimationFrame(() => scrollToTop());
                setTimeout(() => scrollToTop(), 50);
            } else {
                const lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.role === 'model') {
                    // Bot vừa trả lời xong: Cuộn mượt đến đầu câu trả lời / câu hỏi
                    // để người dùng đọc ngay phần giải thích từ dòng đầu tiên, KHÔNG bị tụt xuống đáy các thẻ cards!
                    requestAnimationFrame(() => {
                        scrollToLastInteraction(true);
                        setTimeout(() => scrollToLastInteraction(true), 60);
                    });
                } else {
                    // Người dùng vừa gửi câu hỏi -> Cuộn xuống dưới để thấy câu hỏi và chấm typing
                    scrollToBottom(true);
                }
            }
        }
    }, [messages, isOpen]);

    useEffect(() => {
        if (isLoading && isOpen) {
            scrollToBottom(true);
        }
    }, [isLoading, isOpen]);

    const handleSwitchLang = (langCode) => {
        setSelectedLang(langCode);
        if (messages.length === 1 && messages[0].id.startsWith('welcome')) {
            const welcomeText = welcomeMessages[langCode] || welcomeMessages.vi;
            setMessages([
                {
                    ...messages[0],
                    detected_lang: langCode,
                    text: welcomeText
                }
            ]);
        }
    };

    const handleSendMessage = async (textToSend) => {
        const query = (textToSend || inputValue).trim();
        if (!query || isLoading) return;

        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
        }
        if (recognitionRef.current && isListening) {
            try {
                recognitionRef.current.stop();
            } catch {
                // ignore
            }
            setIsListening(false);
        }

        const userTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: query,
            time: userTime
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInputValue('');
        setIsLoading(true);

        try {
            const history = updatedMessages.slice(-9, -1).map((m) => ({
                role: m.role === 'model' ? 'model' : 'user',
                text: m.text
            }));

            const data = await askChatbot(query, history);

            const hotlineNum = settings?.hotline || '1900 8899';
            const botTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const botReplyText =
                data?.reply ||
                `Dạ em xin lỗi Quý khách, hệ thống đang bận một chút. Quý khách vui lòng thử lại hoặc liên hệ Hotline **${hotlineNum}** để được hỗ trợ tức thì ạ!`;
            const detectedLang = data?.detected_lang || selectedLang || 'vi';

            if (data?.detected_lang && ['vi', 'en', 'ko', 'zh'].includes(data.detected_lang)) {
                setSelectedLang(data.detected_lang);
            }

            if (data?.active_stay) {
                setActiveStayInfo(data.active_stay);
            }

            const botMsg = {
                id: `bot-${Date.now()}`,
                role: 'model',
                text: botReplyText,
                time: botTime,
                source: data?.source || 'ai',
                detected_lang: detectedLang,
                queried_dates: data?.queried_dates || null,
                suggested_rooms: Array.isArray(data?.suggested_rooms) ? data.suggested_rooms : [],
                suggested_services: Array.isArray(data?.suggested_services) ? data.suggested_services : [],
                tracked_bookings: Array.isArray(data?.tracked_bookings) ? data.tracked_bookings : []
            };

            setMessages((prev) => [...prev, botMsg]);

            if (!isOpen) {
                setHasUnread(true);
            }
        } catch (error) {
            console.error('Lỗi khi gọi API Chatbot:', error);
            const hotlineNum = settings?.hotline || '1900 8899';
            const errorMsg = {
                id: `error-${Date.now()}`,
                role: 'model',
                detected_lang: selectedLang,
                text:
                    selectedLang === 'en'
                        ? `I apologize for the temporary interruption. Please contact our 24/7 Concierge Hotline at **${hotlineNum}** for immediate assistance!`
                        : `Dạ em xin lỗi Quý khách! Kết nối của em đang gặp gián đoạn tạm thời. Quý khách vui lòng liên hệ trực tiếp Hotline lễ tân 24/7 **${hotlineNum}** để được chuyên viên hỗ trợ ngay ạ!`,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetChat = () => {
        setShowResetConfirm(true);
    };

    const confirmResetChat = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
        }
        if (recognitionRef.current && isListening) {
            try {
                recognitionRef.current.stop();
            } catch {
                // ignore
            }
            setIsListening(false);
        }

        const welcomeText = welcomeMessages[selectedLang] || welcomeMessages.vi;
        const freshWelcome = {
            id: `welcome-${Date.now()}`,
            role: 'model',
            detected_lang: selectedLang,
            text: welcomeText,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([freshWelcome]);
        setShowResetConfirm(false);
        try {
            sessionStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const currentDict = I18N_DICT[selectedLang] || I18N_DICT.vi;
    const currentChips = QUICK_CHIPS_BY_LANG[selectedLang] || QUICK_CHIPS_BY_LANG.vi;

    return (
        <aside aria-label="Khung trò chuyện Trợ lý AI Khách Sạn TA Đà Nẵng" className="print:hidden no-print">
            {/* 1. NÚT MỞ CHAT NỔI (FLOATING BUTTON) TÔNG SÁNG TRANG NHÃ DỊU MẮT & BONG BÓNG CHÀO ĐÓN */}
            <div
                className={`fixed z-[90] select-none flex flex-col items-end ${
                    hasMobileStickyBar ? 'bottom-20 right-4 sm:bottom-6 sm:right-6' : 'bottom-4 right-4 sm:bottom-6 sm:right-6'
                }`}
            >
                {/* Bong bóng chào đón thông minh (Proactive Callout Bubble) */}
                {showCalloutBubble && !isOpen && (
                    <div
                        onClick={() => {
                            setIsOpen(true);
                            setShowCalloutBubble(false);
                        }}
                        className="mb-3.5 p-3.5 sm:p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_15px_35px_-5px_rgba(15,23,42,0.14)] text-slate-800 max-w-[280px] sm:max-w-[320px] cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-400 group relative hover:border-sky-300 transition-all select-none"
                        role="region"
                        aria-label="Thông điệp chào mừng từ Trợ lý AI"
                    >
                        {/* Mũi tên trỏ xuống dưới góc phải */}
                        <div className="absolute -bottom-2 right-8 sm:right-10 w-4 h-4 bg-white/95 border-b border-r border-slate-200/90 rotate-45 transform" />

                        {/* Header bong bóng */}
                        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                                    <Bot className="w-3.5 h-3.5 text-sky-600" />
                                    Trợ Lý AI {starCount}★
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleDismissBubble}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Đóng thông báo"
                                aria-label="Đóng thông điệp chào mừng"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Lời chào cá nhân hóa */}
                        <p className="text-xs text-slate-600 leading-relaxed font-normal">
                            Kính chào {user?.full_name ? <strong className="text-slate-900 font-bold">{user.full_name}</strong> : 'Quý khách'}!
                            <br />
                            Em có thể hỗ trợ Quý khách <span className="text-sky-700 font-semibold">tra cứu phòng trống ngày mai</span> hoặc giải đáp dịch vụ không ạ?
                        </p>

                        {/* Gợi ý nhanh 1 chạm */}
                        <div className="mt-2.5 pt-2 flex flex-wrap gap-1.5 border-t border-slate-100">
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(true);
                                    setShowCalloutBubble(false);
                                    handleSendMessage('Ngày mai còn phòng trống không và bảng giá thế nào?');
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 shadow-2xs transition-all active:scale-95 cursor-pointer"
                            >
                                <BedDouble className="w-3 h-3 text-sky-600" />
                                <span>Phòng trống ngày mai</span>
                            </span>
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(true);
                                    setShowCalloutBubble(false);
                                    handleSendMessage('Gợi ý lịch trình tham quan Đà Nẵng, Cầu Rồng phun lửa và dịch vụ xe đưa đón VIP');
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all active:scale-95 cursor-pointer"
                            >
                                <Compass className="w-3 h-3 text-slate-600" />
                                <span>Du lịch Đà Nẵng</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Nút Floating Button chính - Phong cách Soft Sky & Pearl White dịu mắt, thanh lịch */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative group flex items-center gap-2.5 pl-2.5 pr-4 py-2 sm:pl-3 sm:pr-4 sm:py-2.5 rounded-full bg-gradient-to-r from-sky-50/95 via-white to-cyan-50/95 hover:from-sky-100/90 hover:via-white hover:to-cyan-100/90 backdrop-blur-md text-slate-800 font-medium border border-sky-200/90 hover:border-sky-300 transition-all duration-300 ease-out cursor-pointer hover:-translate-y-0.5 active:scale-95 shadow-[0_10px_26px_-6px_rgba(14,165,233,0.22)]"
                    title={`Trợ Lý Ảo AI - ${hotelName} ${starCount}★ (Multilingual Concierge)`}
                    aria-expanded={isOpen}
                    aria-label={`Mở khung trò chuyện với Trợ lý AI ${starCount} sao`}
                >
                    {/* Hiệu ứng vệt sáng dịu nhẹ lướt qua (Shimmer) */}
                    <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                        <span className="absolute -inset-full top-0 bg-gradient-to-r from-transparent via-sky-200/30 to-transparent transform -skew-x-12 group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                    </span>

                    {/* Avatar AI Xanh Biển dịu mắt + Chấm Online */}
                    <div className="relative flex-shrink-0">
                        <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-sky-500 via-blue-500 to-cyan-500 text-white shadow-sm shadow-sky-500/25">
                            {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-white transition-transform duration-200" />
                            ) : (
                                <Bot className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-white" />
                            )}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    {/* Chữ hiển thị tinh gọn, dịu mắt */}
                    <div className="hidden sm:flex flex-col text-left pr-0.5">
                        <span className="text-xs font-bold text-slate-800 tracking-wide flex items-center gap-1 leading-tight">
                            <span>Trợ Lý AI</span>
                            <span className="text-amber-500 text-[10px] font-extrabold">{starCount}★</span>
                        </span>
                        <span className="text-[10px] text-sky-600 font-medium leading-tight mt-0.5">
                            Online 24/7
                        </span>
                    </div>

                    {/* Huy hiệu tin nhắn mới chưa đọc */}
                    {hasUnread && !isOpen && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white text-[9px] font-bold text-white items-center justify-center">
                                1
                            </span>
                        </span>
                    )}
                </button>
            </div>

            {/* 2. CỬA SỔ CHAT WINDOW SANG TRỌNG DỊU MẮT */}
            {isOpen && (
                <div
                    className="fixed z-[9999] flex flex-col bg-white shadow-2xl border border-sky-100 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300 inset-0 rounded-none sm:rounded-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[610px] sm:max-h-[85vh]"
                    style={{
                        boxShadow: '0 20px 45px -12px rgba(14, 165, 233, 0.16), 0 8px 20px -6px rgba(15, 23, 42, 0.08)'
                    }}
                >
                    {/* A. HEADER TÔNG XANH PASTEL & TRẮNG NGỌC TRAI DỊU MẮT */}
                    <header
                        className="bg-gradient-to-r from-sky-50/95 via-white to-cyan-50/90 text-slate-800 px-4 py-3 border-b border-sky-100/90 flex items-center justify-between shadow-2xs select-none"
                        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))' }}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex-shrink-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 via-blue-500 to-cyan-500 p-0.5 shadow-xs">
                                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-sky-600">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                </div>
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="text-sm font-bold text-slate-800 tracking-tight font-sans m-0 whitespace-nowrap">
                                        Trợ Lý AI {starCount}★
                                    </h2>
                                    <span className="text-[9px] bg-sky-100/80 text-sky-700 border border-sky-200 px-1.5 py-0.2 rounded font-semibold tracking-wider flex-shrink-0 uppercase">
                                        Concierge
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                                    <span>{hotelName}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-emerald-600 font-medium">Online 24/7</span>
                                </p>
                            </div>
                        </div>

                        {/* Nút điều khiển: Ngôn ngữ + Làm mới + Đóng */}
                        <div className="flex items-center gap-1 flex-shrink-0" ref={langDropdownRef}>
                            <div className="relative">
                                <button
                                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-sky-50 text-slate-700 border border-sky-200/80 shadow-2xs transition-all cursor-pointer active:scale-95"
                                    title="Chọn ngôn ngữ / Select language"
                                    aria-label="Chọn ngôn ngữ giao tiếp"
                                >
                                    <span className="text-sm leading-none">{SUPPORTED_LANGS.find((l) => l.code === selectedLang)?.flag}</span>
                                    <span className="font-bold text-[11px] text-sky-700">{selectedLang.toUpperCase()}</span>
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>

                                {showLangDropdown && (
                                    <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95">
                                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                            Ngôn ngữ / Language
                                        </div>
                                        {SUPPORTED_LANGS.map((lang) => (
                                            <button
                                                key={lang.code}
                                                onClick={() => {
                                                    handleSwitchLang(lang.code);
                                                    setShowLangDropdown(false);
                                                }}
                                                className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between hover:bg-sky-50 transition-colors cursor-pointer ${
                                                    selectedLang === lang.code ? 'font-bold text-sky-700 bg-sky-50/80' : 'text-slate-700'
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span>{lang.flag}</span>
                                                    <span>{lang.label}</span>
                                                </span>
                                                {selectedLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleResetChat}
                                className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                title="Làm mới cuộc trò chuyện"
                                aria-label="Làm mới cuộc trò chuyện"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Thu nhỏ khung chat"
                                aria-label="Thu nhỏ khung chat"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </header>

                    {/* B. THANH ĐẶC QUYỀN KHÁCH ĐANG LƯU TRÚ (IN-HOUSE GUEST CONCIERGE BAR - TÔNG SÁNG) */}
                    {activeStayInfo && activeStayInfo.is_checked_in && (
                        <div className="bg-amber-50/90 border-b border-amber-200/80 px-3.5 py-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-800">
                            <div className="flex items-center gap-1.5 truncate">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                                <span className="font-semibold text-amber-900 truncate">
                                    {currentDict.inhouse_badge(activeStayInfo.room_number)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleSendMessage('Hóa đơn tạm tính của phòng tôi hiện tại là bao nhiêu?')}
                                    className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold cursor-pointer transition"
                                >
                                    {currentDict.btn_folio}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSendMessage('Dọn phòng giúp tôi')}
                                    className="px-2 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-medium cursor-pointer transition"
                                >
                                    {currentDict.btn_clean}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* HỘP THOẠI XÁC NHẬN LÀM MỚI TINH TẾ NGAY TRONG WIDGET */}
                    {showResetConfirm && (
                        <div className="bg-sky-50/95 border-b border-sky-200/80 px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                            <span className="font-medium flex items-center gap-1.5 text-slate-700">
                                <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                                Làm mới toàn bộ cuộc trò chuyện?
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={confirmResetChat}
                                    className="px-2.5 py-1 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer shadow-xs active:scale-95"
                                >
                                    Đồng ý
                                </button>
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    )}

                    {/* C. KHUNG HIỂN THỊ TIN NHẮN (MESSAGES STREAM) */}
                    <div
                        ref={chatContainerRef}
                        className="flex-1 p-3.5 overflow-y-auto overflow-x-hidden space-y-3.5 bg-gradient-to-b from-slate-50/50 to-white overscroll-contain"
                        tabIndex={0}
                        aria-label="Danh sách tin nhắn cuộc trò chuyện"
                    >
                        {messages.map((msg) => {
                            const isBot = msg.role === 'model';
                            const hasRooms = isBot && Array.isArray(msg.suggested_rooms) && msg.suggested_rooms.length > 0;
                            const hasServices = isBot && Array.isArray(msg.suggested_services) && msg.suggested_services.length > 0;
                            const hasBookings = isBot && Array.isArray(msg.tracked_bookings) && msg.tracked_bookings.length > 0;
                            const isWelcome = isBot && msg.id.startsWith('welcome');
                            const hasSuggestions = hasRooms || hasServices || hasBookings || isWelcome;

                            const msgLang = msg.detected_lang || selectedLang || 'vi';
                            const dict = I18N_DICT[msgLang] || I18N_DICT.vi;

                            return (
                                <div
                                    key={msg.id}
                                    id={`chat-msg-${msg.id}`}
                                    className={`flex items-start gap-2.5 w-full min-w-0 ${isBot ? 'justify-start' : 'justify-end'}`}
                                >
                                    {isBot && (
                                        <div className="w-7 h-7 rounded-full bg-sky-50 border border-sky-200 text-sky-600 flex-shrink-0 flex items-center justify-center text-xs shadow-2xs mt-0.5">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}

                                    <div
                                        className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] shadow-xs break-words overflow-hidden ${
                                            isBot
                                                ? `bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] ${
                                                      hasSuggestions ? 'flex-1 min-w-0 max-w-full sm:max-w-[92%]' : 'max-w-[85%]'
                                                  }`
                                                : 'bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 text-white rounded-tr-xs shadow-md shadow-sky-900/15 max-w-[85%] ml-auto'
                                        }`}
                                    >
                                        <div className="leading-relaxed">
                                            {isBot ? renderFormattedContent(msg.text) : <div className="whitespace-pre-wrap">{msg.text}</div>}
                                        </div>

                                        {/* 1. CÁC GỢI Ý HỎI NHANH 1 CHẠM NẰM TRONG BONG BÓNG CHÀO MỪNG */}
                                        {isWelcome && (
                                            <div className="mt-3 pt-2.5 border-t border-amber-100/90 space-y-2">
                                                <div className="text-[11px] font-bold text-amber-900 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                                        {dict.quick_title}
                                                    </span>
                                                    <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-normal">
                                                        {selectedLang === 'vi' ? 'Quy đổi USD/KRW/CNY' : 'Auto USD/KRW/CNY'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                    {currentChips.map((chip) => {
                                                        const ChipIcon = chip.icon || Sparkles;
                                                        return (
                                                            <button
                                                                key={chip.id}
                                                                onClick={() => handleSendMessage(chip.query)}
                                                                disabled={isLoading}
                                                                className="flex items-center gap-2 text-left text-[11px] p-2 sm:p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/90 border border-amber-200/90 text-slate-800 font-medium transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 group"
                                                            >
                                                                <span className="w-5 h-5 rounded-lg bg-amber-100/90 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                                    <ChipIcon className="w-3.5 h-3.5 text-amber-700" />
                                                                </span>
                                                                <span className="truncate">{chip.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* 2. THẺ TIẾN TRÌNH ĐƠN ĐẶT PHÒNG THỜI GIAN THỰC (BOOKING PROGRESS TRACKER) */}
                                        {hasBookings && (
                                            <div className="mt-3 pt-2.5 border-t border-amber-100/90 space-y-3">
                                                <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5 text-amber-900">
                                                        <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                                                        {dict.booking_title}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                        {dict.found_count(msg.tracked_bookings.length)}
                                                    </span>
                                                </div>

                                                {msg.tracked_bookings.map((bk) => {
                                                    const isCancelled = bk.step_index === -1;
                                                    const currentStep = bk.step_index;

                                                    const steps = [
                                                        { num: 1, label: dict.step_reserved, icon: FileText },
                                                        { num: 2, label: dict.step_confirmed, icon: CheckCircle2 },
                                                        { num: 3, label: dict.step_stay, icon: Key },
                                                        { num: 4, label: dict.step_done, icon: CheckCheck }
                                                    ];

                                                    return (
                                                        <div
                                                            key={bk.id || bk.booking_code}
                                                            className="bg-gradient-to-b from-white to-amber-50/30 rounded-xl border border-amber-200/90 p-3 shadow-xs hover:shadow-md transition-all duration-200 text-left"
                                                        >
                                                            <div className="flex items-center justify-between border-b border-amber-100/80 pb-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono font-bold text-amber-900 text-xs tracking-wider">
                                                                        #{bk.booking_code}
                                                                    </span>
                                                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                                                                        {starCount}★ TA
                                                                    </span>
                                                                </div>
                                                                <span
                                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1 ${
                                                                        isCancelled
                                                                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                                            : currentStep === 3
                                                                            ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse'
                                                                            : currentStep === 4
                                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                                    }`}
                                                                >
                                                                    <span
                                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                                            isCancelled
                                                                                ? 'bg-rose-500'
                                                                                : currentStep === 3
                                                                                ? 'bg-blue-600'
                                                                                : currentStep === 4
                                                                                ? 'bg-emerald-600'
                                                                                : 'bg-amber-500'
                                                                        }`}
                                                                    />
                                                                    {bk.status_label}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 text-[11px] mt-2.5 text-slate-700">
                                                                <div>
                                                                    <span className="text-slate-400 block text-[10px]">{dict.room_category}</span>
                                                                    <span className="font-semibold text-slate-900 truncate block" title={bk.room_name}>
                                                                        {bk.room_name}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400 block text-[10px]">{dict.guest_name}</span>
                                                                    <span className="font-medium text-slate-800 truncate block">
                                                                        {bk.guest_name}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400 block text-[10px]">{dict.stay_dates}</span>
                                                                    <span className="font-medium text-slate-800 text-[10px]">
                                                                        {bk.check_in_date} ➔ {bk.check_out_date}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400 block text-[10px]">{dict.total_payment}</span>
                                                                    <span className="font-bold text-amber-700 text-xs">
                                                                        {bk.total_amount}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {!isCancelled ? (
                                                                <div className="mt-3 pt-2.5 border-t border-slate-100">
                                                                    <div className="relative flex items-center justify-between px-3">
                                                                        <div className="absolute left-6 right-6 top-3 h-0.5 bg-slate-200 z-0 overflow-hidden rounded-full">
                                                                            <div
                                                                                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                                                                                style={{
                                                                                    width: `${Math.max(0, Math.min(100, ((currentStep - 1) / 3) * 100))}%`
                                                                                }}
                                                                            />
                                                                        </div>

                                                                        {steps.map((st) => {
                                                                            const IconComp = st.icon;
                                                                            const isDone = currentStep >= st.num;
                                                                            const isCurrent = currentStep === st.num;

                                                                            return (
                                                                                <div key={st.num} className="relative z-10 flex flex-col items-center">
                                                                                    <div
                                                                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                                                                                            isCurrent
                                                                                                ? 'bg-amber-600 text-white ring-4 ring-amber-100 scale-110 shadow-xs'
                                                                                                : isDone
                                                                                                ? 'bg-emerald-500 text-white shadow-xs'
                                                                                                : 'bg-white border-2 border-slate-300 text-slate-400'
                                                                                        }`}
                                                                                    >
                                                                                        <IconComp className="w-3 h-3" />
                                                                                    </div>
                                                                                    <span
                                                                                        className={`text-[9px] mt-1 font-medium ${
                                                                                            isCurrent
                                                                                                ? 'text-amber-800 font-bold'
                                                                                                : isDone
                                                                                                ? 'text-slate-700 font-medium'
                                                                                                : 'text-slate-400'
                                                                                        }`}
                                                                                    >
                                                                                        {st.label}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-50/70 p-2 rounded-lg">
                                                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span>{dict.cancelled_warning}</span>
                                                                </div>
                                                            )}

                                                            <div className="mt-3 pt-2 border-t border-amber-100/80 flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setIsOpen(false);
                                                                        navigate('/booking-history');
                                                                    }}
                                                                    className="flex-1 py-1.5 px-2 text-[10px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 rounded-lg transition-colors text-center cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                                                                    title="Xem chi tiết đơn trong Lịch sử đặt phòng"
                                                                >
                                                                    <CalendarCheck className="w-3 h-3 text-amber-700" />
                                                                    {dict.booking_history}
                                                                </button>
                                                                <a
                                                                    href={`tel:${(settings?.hotline || '1900 8899').replace(/\s+/g, '')}`}
                                                                    className="py-1.5 px-3 text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
                                                                    title="Gọi Hotline hỗ trợ lễ tân 24/7"
                                                                >
                                                                    <Phone className="w-3 h-3 text-slate-500" />
                                                                    {dict.hotline_call.replace('1900 8899', settings?.hotline || '1900 8899')}
                                                                </a>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* 3. GỢI Ý THẺ PHÒNG TƯƠNG TÁC KÈM DEEP-LINK NGÀY CHECK-IN / CHECK-OUT */}
                                        {hasRooms && (
                                            <div className="mt-3 pt-2.5 border-t border-amber-100/90">
                                                <div className="text-[11px] font-bold text-amber-900 mb-2 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                                                        {dict.rooms_title}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                        {dict.swipe_hint}
                                                    </span>
                                                </div>

                                                <div
                                                    className="flex gap-2.5 overflow-x-auto pb-2.5 pt-0.5 scroll-smooth overscroll-x-contain touch-pan-x px-0.5"
                                                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                                                >
                                                    {msg.suggested_rooms.map((room) => {
                                                        const isAvailable = room.available_count > 0;
                                                        const cIn = room.check_in || msg.queried_dates?.check_in || '';
                                                        const cOut = room.check_out || msg.queried_dates?.check_out || '';
                                                        const dateBadge =
                                                            room.check_in_display && room.check_out_display
                                                                ? `${room.check_in_display.slice(0, 5)} ➔ ${room.check_out_display.slice(0, 5)}`
                                                                : null;

                                                        return (
                                                            <div
                                                                key={room.id}
                                                                className="w-[220px] flex-shrink-0 bg-white rounded-xl border border-amber-200/90 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group"
                                                            >
                                                                <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                                                                    <img
                                                                        src={room.image_url}
                                                                        alt={room.name}
                                                                        loading="lazy"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src =
                                                                                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80';
                                                                        }}
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                    />
                                                                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                                                                        {isAvailable ? (
                                                                            <span className="bg-emerald-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs flex items-center gap-1">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                                                                {dict.avail_rooms(room.available_count)}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="bg-rose-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs">
                                                                                {dict.sold_out}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="absolute top-1.5 right-1.5">
                                                                        <span className="bg-slate-900/60 text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded backdrop-blur-xs">
                                                                            {dict.luxury_tag}
                                                                        </span>
                                                                    </div>
                                                                    {dateBadge && (
                                                                        <div className="absolute bottom-1.5 left-1.5">
                                                                            <span className="bg-white/90 text-slate-800 border border-slate-200 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-2xs inline-flex items-center gap-1">
                                                                                <Calendar className="w-2.5 h-2.5 text-slate-500" />
                                                                                <span>{dateBadge}</span>
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="p-2.5 flex-1 flex flex-col justify-between">
                                                                    <div>
                                                                        <h4 className="font-bold text-slate-800 text-xs truncate" title={room.name}>
                                                                            {room.name}
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                                                                            <BedDouble className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                                                            <span>{dict.max_guests(room.bed_type, room.capacity)}</span>
                                                                        </p>
                                                                        <div className="mt-1.5 flex flex-col">
                                                                            <span className="text-[10px] text-slate-400">{dict.price_from}</span>
                                                                            <span className="text-xs font-bold text-amber-700 leading-tight">
                                                                                {room.price_formatted}
                                                                                <span className="text-[9px] font-normal text-slate-500">{dict.per_night}</span>
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                                                                        <button
                                                                            onClick={() => {
                                                                                setIsOpen(false);
                                                                                navigate(`/rooms/${room.id}`);
                                                                            }}
                                                                            className="flex-1 py-1.5 px-1 text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                                                                            title="Xem chi tiết hạng phòng"
                                                                        >
                                                                            <Eye className="w-3 h-3 text-slate-500" />
                                                                            {dict.view_details}
                                                                        </button>

                                                                        <button
                                                                            onClick={() => {
                                                                                if (isAvailable) {
                                                                                    setIsOpen(false);
                                                                                    const queryStr =
                                                                                        cIn && cOut
                                                                                            ? `?checkIn=${encodeURIComponent(cIn)}&checkOut=${encodeURIComponent(cOut)}`
                                                                                            : '';
                                                                                    navigate(`/checkout/${room.id}${queryStr}`, {
                                                                                        state: {
                                                                                            checkInDate: cIn,
                                                                                            checkOutDate: cOut
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }}
                                                                            disabled={!isAvailable}
                                                                            className={`flex-1 py-1.5 px-1 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                                                                                isAvailable
                                                                                    ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white shadow-xs active:scale-95'
                                                                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                                            }`}
                                                                            title={isAvailable ? 'Đặt phòng này ngay' : 'Phòng hiện đã kín'}
                                                                        >
                                                                            <CalendarCheck className="w-3 h-3" />
                                                                            {dict.book_now}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* 4. GỢI Ý THẺ DỊCH VỤ TƯƠNG TÁC (INTERACTIVE SERVICE CARDS) */}
                                        {hasServices && (
                                            <div className="mt-3 pt-2.5 border-t border-amber-100/90">
                                                <div className="text-[11px] font-bold text-amber-900 mb-2 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Utensils className="w-3.5 h-3.5 text-amber-600" />
                                                        {dict.services_title}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                        {dict.swipe_hint}
                                                    </span>
                                                </div>

                                                <div
                                                    className="flex gap-2.5 overflow-x-auto pb-2.5 pt-0.5 scroll-smooth overscroll-x-contain touch-pan-x px-0.5"
                                                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                                                >
                                                    {msg.suggested_services.map((srv) => (
                                                        <div
                                                            key={srv.id}
                                                            className="w-[205px] flex-shrink-0 bg-white rounded-xl border border-amber-200/90 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group"
                                                        >
                                                            <div className="relative h-24 w-full bg-slate-100 overflow-hidden">
                                                                <img
                                                                    src={srv.image_url}
                                                                    alt={srv.name}
                                                                    loading="lazy"
                                                                    onError={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src =
                                                                            'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80';
                                                                    }}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                <div className="absolute top-1.5 left-1.5">
                                                                    <span className="bg-amber-100/95 text-amber-800 border border-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-xs">
                                                                        {srv.category}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="p-2.5 flex-1 flex flex-col justify-between">
                                                                <div>
                                                                    <h4 className="font-bold text-slate-800 text-xs truncate" title={srv.name}>
                                                                        {srv.name}
                                                                    </h4>
                                                                    {srv.description && (
                                                                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                                                            {srv.description}
                                                                        </p>
                                                                    )}
                                                                    <div className="mt-1.5 flex flex-col">
                                                                        <span className="text-[10px] text-slate-400">{dict.service_price}</span>
                                                                        <span className="text-xs font-bold text-amber-700 leading-tight">
                                                                            {srv.price_formatted}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    onClick={() => {
                                                                        setIsOpen(false);
                                                                        navigate(
                                                                            `/services?serviceId=${encodeURIComponent(srv.id)}&q=${encodeURIComponent(srv.name)}`,
                                                                            {
                                                                                state: {
                                                                                    serviceId: srv.id,
                                                                                    serviceName: srv.name
                                                                                }
                                                                            }
                                                                        );
                                                                    }}
                                                                    className="w-full mt-2.5 py-1.5 px-2 text-[10px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 rounded-lg transition-colors text-center cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                                                                    title="Xem thực đơn và gửi yêu cầu dịch vụ"
                                                                >
                                                                    <Utensils className="w-3 h-3 text-amber-700" />
                                                                    {dict.view_menu_order}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer tin nhắn */}
                                        <div
                                            className={`text-[10px] mt-2 flex items-center justify-between gap-1 pt-1.5 border-t ${
                                                isBot ? 'text-slate-400 border-slate-100' : 'text-sky-100/90 border-sky-400/30'
                                            }`}
                                        >
                                            {isBot ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSpeakMessage(msg)}
                                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                                            speakingMsgId === msg.id
                                                                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                                                                : 'text-slate-500 hover:text-amber-800 hover:bg-amber-50/80 border border-slate-200/60 hover:border-amber-300'
                                                        }`}
                                                        title={speakingMsgId === msg.id ? dict.stop_speak : dict.speak_btn}
                                                    >
                                                        {speakingMsgId === msg.id ? (
                                                            <>
                                                                <VolumeX className="w-3 h-3 text-amber-700" />
                                                                <span className="font-semibold text-amber-900">{dict.stop_speak}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Volume2 className="w-3 h-3 text-slate-500" />
                                                                <span>{dict.speak_btn}</span>
                                                            </>
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyMessage(msg)}
                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                                            copiedMsgId === msg.id
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs font-semibold'
                                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/60'
                                                        }`}
                                                        title={copiedMsgId === msg.id ? dict.copied_btn : dict.copy_btn}
                                                        aria-label={copiedMsgId === msg.id ? dict.copied_btn : dict.copy_btn}
                                                    >
                                                        {copiedMsgId === msg.id ? (
                                                            <>
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                <span>{dict.copied_btn}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-3 h-3 text-slate-400" />
                                                                <span>{dict.copy_btn}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyMessage(msg)}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                                        copiedMsgId === msg.id
                                                            ? 'bg-sky-200/40 text-white font-semibold'
                                                            : 'text-sky-100/80 hover:text-white hover:bg-white/10'
                                                    }`}
                                                    title={copiedMsgId === msg.id ? dict.copied_btn : dict.copy_btn}
                                                    aria-label={copiedMsgId === msg.id ? dict.copied_btn : dict.copy_btn}
                                                >
                                                    {copiedMsgId === msg.id ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-200" />
                                                            <span>{dict.copied_btn}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3 text-sky-200" />
                                                            <span>{dict.copy_btn}</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            <span>{msg.time}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Hiệu ứng đang soạn tin nhắn (Typing indicator) */}
                        {isLoading && (
                            <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex-shrink-0 flex items-center justify-center text-xs shadow-xs mt-0.5">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        <span className="text-xs text-slate-500 ml-2 italic">{currentDict.typing_indicator}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* D. DẢI GỢI Ý NHANH CỐ ĐỊNH TRÊN KHUNG NHẬP (TÔNG SÁNG DỊU MẮT) */}
                    {messages.length > 1 && (
                        <div
                            className="px-3 py-1.5 bg-slate-50/90 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto select-none"
                            style={{ scrollbarWidth: 'none' }}
                        >
                            {currentChips.map((chip) => {
                                const ChipIcon = chip.icon || Sparkles;
                                return (
                                    <button
                                        key={`bar-${chip.id}`}
                                        type="button"
                                        disabled={isLoading}
                                        onClick={() => handleSendMessage(chip.query)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-sky-200/80 whitespace-nowrap transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex-shrink-0"
                                    >
                                        <ChipIcon className="w-3 h-3 text-sky-600" />
                                        <span>{chip.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* BANNER THU ÂM GIỌNG NÓI (VOICE AI LISTENING) */}
                    {isListening && (
                        <div className="px-3 py-2 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-700 font-medium">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                                </span>
                                <span className="text-[11px] font-semibold text-rose-800">{currentDict.voice_listening}</span>
                            </div>
                            <button
                                type="button"
                                onClick={toggleVoiceInput}
                                className="text-[10px] text-rose-700 hover:text-rose-900 bg-white/90 hover:bg-white px-2 py-0.5 rounded-full border border-rose-300 font-semibold transition cursor-pointer shadow-2xs"
                            >
                                {currentDict.voice_stop}
                            </button>
                        </div>
                    )}

                    {voiceError && (
                        <div className="px-3 py-1.5 bg-rose-50 border-t border-rose-200 text-rose-600 text-[11px] flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{voiceError}</span>
                        </div>
                    )}

                    {/* E. KHUNG NHẬP CÂU HỎI (INPUT AREA) */}
                    <div
                        className="p-3 bg-white border-t border-slate-200"
                        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
                    >
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage();
                            }}
                            className="flex items-center gap-2"
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={currentDict.input_placeholder}
                                disabled={isLoading}
                                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 focus:bg-white transition-all disabled:opacity-50"
                            />

                            {/* Nút Micro thu âm câu hỏi bằng giọng nói (Voice AI) */}
                            <button
                                id="btn-voice-input"
                                type="button"
                                onClick={toggleVoiceInput}
                                disabled={isLoading}
                                className={`p-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
                                    isListening
                                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-400 ring-offset-1 animate-pulse'
                                        : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 shadow-2xs hover:shadow-xs active:scale-95'
                                }`}
                                title={isListening ? currentDict.voice_stop : 'Bấm để nói câu hỏi bằng Micro (Voice AI)'}
                                aria-label="Nói câu hỏi bằng Micro"
                            >
                                {isListening ? (
                                    <MicOff className="w-4 h-4 text-white" />
                                ) : (
                                    <Mic className="w-4 h-4 text-sky-700" />
                                )}
                            </button>

                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isLoading}
                                className={`p-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                    inputValue.trim() && !isLoading
                                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white shadow-xs active:scale-95 border border-sky-500'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                                title="Gửi tin nhắn"
                                aria-label="Gửi tin nhắn cho Trợ lý AI"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
                            <span>{hotelName} {starCount}-Star Resort</span>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {currentDict.instant_response}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
