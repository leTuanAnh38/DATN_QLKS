import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    MessageSquare, 
    X, 
    RotateCcw, 
    Send, 
    Sparkles, 
    Bot, 
    ChevronDown, 
    BedDouble, 
    Utensils, 
    ShieldCheck, 
    CalendarCheck, 
    Eye, 
    FileText, 
    CheckCircle2, 
    Key, 
    CheckCheck, 
    AlertCircle, 
    Phone,
    Globe,
    Mic,
    MicOff,
    Volume2,
    VolumeX
} from 'lucide-react';
import { askChatbot } from '../../services/chatbotService';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { useAuth } from '../../store/authStore';

const SESSION_STORAGE_KEY = 'ta_hotel_ai_chat_history_v3';

// Bảng mã ngôn ngữ cho Web Speech API (STT & TTS)
const SPEECH_LANG_MAP = {
    vi: 'vi-VN',
    en: 'en-US',
    ko: 'ko-KR',
    zh: 'zh-CN'
};

// Hàm làm sạch văn bản trước khi đọc bằng Text-to-Speech (bỏ markdown, url, icon thừa)
function cleanTextForSpeech(text) {
    if (!text) return '';
    return text
        .replace(/[*_#`~]/g, '') // Bỏ ký tự markdown
        .replace(/https?:\/\/\S+/g, '') // Bỏ đường link URL
        .replace(/[•\-\+]\s+/g, ', ') // Thay bullet point thành dấu phẩy ngắt giọng tự nhiên
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Bỏ emoji
        .replace(/\s+/g, ' ')
        .trim();
}

const SUPPORTED_LANGS = [
    { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'ko', flag: '🇰🇷', label: '한국어' },
    { code: 'zh', flag: '🇨🇳', label: '中文' }
];

const getWelcomeMessages = (stars = 3, hotelName = 'Khách Sạn TA Đà Nẵng') => ({
    vi: `Dạ em kính chào Quý khách! Em là Trợ lý ảo AI Concierge của **${hotelName} ${stars}★**.\n\nEm luôn sẵn sàng hỗ trợ Quý khách 24/7:\n• 🏨 **Tra cứu phòng trống & Giá hôm nay**\n• 🍽️ **Thực đơn ẩm thực, Spa & Xe đưa đón sân bay**\n• 🏢 **Thủ tục đặt phòng Công ty (xuất hóa đơn VAT)**\n• 🔍 **Tra cứu trạng thái đơn đặt phòng tức thì**\n\nQuý khách có thể bấm nhanh các gợi ý bên dưới hoặc gửi tin nhắn cho em nhé ạ!`,
    en: `Dear Valued Guest! I am your ${stars}-Star AI Concierge at **${hotelName}**.\n\nI am at your service 24/7 to assist with:\n• 🏨 **Room Availability & Rates (with USD conversion)**\n• 🍽️ **Fine Dining Menus, Ocean Spa & Luxury Airport Transfers**\n• 🏢 **Corporate & Group Bookings (VAT Invoices)**\n• 🔍 **Real-Time Reservation Status Lookup**\n\nPlease select one of the quick suggestions below or send me your inquiry!`,
    ko: `고객님 안녕하십니까! **${hotelName} ${stars}성급 호텔 & 리조트**의 AI 컨시어지입니다.\n\n고객님의 완벽한 휴식을 위해 24시간 맞춤 안내를 제공합니다:\n• 🏨 **실시간 빈 객실 및 1박 요금 (KRW 원화 자동 환산)**\n• 🍽️ **인룸 다이닝 메뉴, 오션 스파 & 다낭 공항 리무진 픽업**\n• 🏢 **기업/단체 예약 및 공식 세금계산서 발행**\n• 🔍 **실시간 예약 진행 상태 즉시 조회**\n\n아래 빠른 질문 버튼을 누르시거나 언제든 편하게 질문해 주세요!`,
    zh: `尊敬的贵宾，您好！我是**${hotelName} ${stars}星级度假酒店**的专属AI礼宾顾问。\n\n我将24小时竭诚为您提供服务：\n• 🏨 **实时客房空房与今日优惠房价（人民币CNY自动换算）**\n• 🍽️ **特色餐饮菜单、海景水疗SPA与豪华机场接送服务**\n• 🏢 **商务会奖（M.I.C.E）与企业团队预订政策**\n• 🔍 **实时预订订单进度追踪**\n\n您可以点击下方快捷问题或直接输入您的需求！`
});

const WELCOME_MESSAGES = getWelcomeMessages(3, 'Khách Sạn TA Đà Nẵng');

const QUICK_CHIPS_BY_LANG = {
    vi: [
        { id: 'rooms_avail', label: '🏨 Phòng trống & Giá hôm nay', query: 'Phòng trống và bảng giá phòng hôm nay thế nào?' },
        { id: 'services_dining', label: '🍽️ Dịch vụ Spa & Xe đưa đón', query: 'Khách sạn có những dịch vụ Spa, Xe đưa đón sân bay và ẩm thực nào?' },
        { id: 'corporate_vat', label: '🏢 Đặt phòng Công ty (VAT)', query: 'Tôi muốn tìm hiểu thủ tục đặt phòng Công ty, chính sách chiết khấu đoàn và xuất hóa đơn VAT.' },
        { id: 'my_booking', label: '🔍 Tra cứu đơn đặt phòng', query: 'Kiểm tra thông tin đơn đặt phòng của tôi' }
    ],
    en: [
        { id: 'rooms_avail', label: '🏨 Room Rates (in USD)', query: 'What are today\'s available rooms and rates in USD?' },
        { id: 'services_dining', label: '🍽️ Dining, Spa & Shuttle', query: 'What dining, Spa and airport transfer services do you offer?' },
        { id: 'corporate_vat', label: '🏢 Corporate & VAT Invoice', query: 'Tell me about corporate booking policies and VAT invoices.' },
        { id: 'my_booking', label: '🔍 Track My Reservation', query: 'Check my booking reservation status' }
    ],
    ko: [
        { id: 'rooms_avail', label: '🏨 객실 공실 및 요금 (KRW)', query: '오늘 이용 가능한 객실과 1박 요금(KRW 원화)을 알려주세요.' },
        { id: 'services_dining', label: '🍽️ 스파 & 공항 리무진 픽업', query: '호텔의 인룸 다이닝, 스파 및 다낭 공항 리무진 픽업 서비스 안내해 주세요.' },
        { id: 'corporate_vat', label: '🏢 기업/단체 예약 & 세금계산서', query: '법인 단체 예약 할인 및 세금계산서 발행 정책이 어떻게 되나요?' },
        { id: 'my_booking', label: '🔍 내 예약 내역 조회', query: '내 예약 내역 확인해 줘' }
    ],
    zh: [
        { id: 'rooms_avail', label: '🏨 今日空房与房价 (CNY)', query: '请问今天有哪些空房和房价（人民币换算）？' },
        { id: 'services_dining', label: '🍽️ 餐饮美食、SPA与接送机', query: '请介绍酒店的餐饮服务、SPA水疗及岘港机场接送服务。' },
        { id: 'corporate_vat', label: '🏢 企业团队与增值税发票', query: '请问企业团队预订优惠和增值税发票政策。' },
        { id: 'my_booking', label: '🔍 实时预订查询', query: '查询我的客房预订订单状态' }
    ]
};

const I18N_DICT = {
    vi: {
        currency_badge: 'Đa ngôn ngữ & Tự động quy đổi tỷ giá (USD / KRW / CNY)',
        quick_title: 'Gợi ý hỏi nhanh 1 chạm:',
        auto_fill: 'Tự động điền',
        rooms_title: 'Phòng gợi ý & Bảng giá hôm nay:',
        swipe_hint: 'Vuốt sang để xem thêm 👉',
        avail_rooms: (n) => `Còn ${n} phòng`,
        sold_out: 'Tạm hết phòng',
        luxury_tag: 'Đặc Quyền VIP',
        max_guests: (b, c) => `${b} • Tối đa ${c} khách`,
        price_from: 'Giá từ:',
        per_night: ' /đêm',
        view_details: 'Chi tiết',
        book_now: 'Đặt ngay',
        services_title: 'Dịch vụ Ẩm thực & Tiện ích nổi bật:',
        service_price: 'Giá dịch vụ:',
        view_menu_order: 'Xem Menu & Đặt món',
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
        input_placeholder: 'Hỏi giá phòng, dịch vụ, đơn đặt phòng...',
        typing_indicator: 'Trợ lý đang tra cứu số liệu...',
        instant_response: 'Phản hồi tức thì 24/7',
        speak_btn: 'Nghe đọc',
        stop_speak: 'Dừng đọc',
        voice_listening: 'Đang lắng nghe... Hãy nói câu hỏi',
        voice_stop: 'Dừng',
        voice_not_supported: 'Trình duyệt không hỗ trợ nhận diện giọng nói. Quý khách vui lòng dùng Chrome hoặc Edge.',
        voice_denied: 'Microphone chưa được cấp quyền truy cập.'
    },
    en: {
        currency_badge: 'Multilingual & Auto Currency Conversion (USD / KRW / CNY)',
        quick_title: 'Quick 1-Tap Suggestions:',
        auto_fill: 'Auto fill',
        rooms_title: 'Recommended Rooms & Rates:',
        swipe_hint: 'Swipe to view more 👉',
        avail_rooms: (n) => `${n} rooms left`,
        sold_out: 'Fully booked',
        luxury_tag: 'VIP Luxury',
        max_guests: (b, c) => `${b} • Up to ${c} guests`,
        price_from: 'From:',
        per_night: ' /night',
        view_details: 'Details',
        book_now: 'Book Now',
        services_title: 'Featured Dining & Amenities:',
        service_price: 'Price:',
        view_menu_order: 'View Menu & Order',
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
        input_placeholder: 'Ask about rooms, rates, dining, booking status...',
        typing_indicator: 'AI Concierge is fetching real-time data...',
        instant_response: 'Instant 24/7 Response',
        speak_btn: 'Listen',
        stop_speak: 'Stop',
        voice_listening: 'Listening... Speak your question now',
        voice_stop: 'Stop',
        voice_not_supported: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.',
        voice_denied: 'Microphone access was denied.'
    },
    ko: {
        currency_badge: '다국어 자동 지원 & 원화(KRW)/달러(USD) 실시간 환산',
        quick_title: '빠른 1-터치 추천 질문:',
        auto_fill: '자동 입력',
        rooms_title: '추천 맞춤 객실 및 요금:',
        swipe_hint: '옆으로 스크롤하여 더보기 👉',
        avail_rooms: (n) => `${n}개 객실 남음`,
        sold_out: '예약 마감',
        luxury_tag: '5성급 럭셔리',
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
        cancelled_warning: '취소된 예약 내역입니다. 문의 사항은 컨시어지 데스크로 연락해 주세요.',
        booking_history: '예약 내역',
        hotline_call: '핫라인 +84 1900 8899',
        input_placeholder: '객실 요금, 다이닝, 공항 픽업, 예약 상태 질문...',
        typing_indicator: 'AI 컨시어지가 데이터를 조회 중입니다...',
        instant_response: '24시간 연중무휴 즉시 응답',
        speak_btn: '음성 듣기',
        stop_speak: '듣기 중지',
        voice_listening: '음성을 듣고 있습니다... 말씀해 주세요',
        voice_stop: '중지',
        voice_not_supported: '현재 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.',
        voice_denied: '마이크 사용 권한이 거부되었습니다.'
    },
    zh: {
        currency_badge: '支持多语言自动识别 & 人民币(CNY)/美元(USD)即时换算',
        quick_title: '快捷一键提问推荐:',
        auto_fill: '自动输入',
        rooms_title: '精选推荐客房与参考房价:',
        swipe_hint: '向右滑动查看更多 👉',
        avail_rooms: (n) => `剩余 ${n} 间空房`,
        sold_out: '线上已售罄',
        luxury_tag: '五星奢华',
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
        input_placeholder: '咨询客房价格、特色餐饮、订单查询...',
        typing_indicator: 'AI礼宾专员正在查询最新系统数据...',
        instant_response: '24小时极速即时回复',
        speak_btn: '语音朗读',
        stop_speak: '停止朗读',
        voice_listening: '正在聆听... 请说出您的问题',
        voice_stop: '停止',
        voice_not_supported: '当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。',
        voice_denied: '麦克风权限已被拒绝。'
    }
};

// Hàm phân giải Markdown đơn giản hỗ trợ in đậm và ngắt dòng
function renderFormattedContent(text) {
    if (!text) return null;

    const lines = text.split('\n');

    return lines.map((line, lineIdx) => {
        // Xử lý in đậm **text**
        const parts = line.split(/(\*\*.*?\*\*)/g);

        const renderedLine = parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={partIdx} className="font-semibold text-slate-900">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            return <React.Fragment key={partIdx}>{part}</React.Fragment>;
        });

        // Nếu là dòng trống
        if (!line.trim()) {
            return <div key={lineIdx} className="h-2" />;
        }

        // Định dạng thụt dòng cho bullet points
        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('+');

        return (
            <div 
                key={lineIdx} 
                className={`${isBullet ? 'pl-2 my-0.5 text-slate-700 leading-relaxed' : 'my-1 leading-relaxed'}`}
            >
                {renderedLine}
            </div>
        );
    });
}

export default function AIChatbotWidget() {
    const navigate = useNavigate();
    const location = useLocation();
    const hasMobileStickyBar = location.pathname.startsWith('/rooms/') || location.pathname.startsWith('/room/') || location.pathname.startsWith('/checkout/');
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const welcomeMessages = getWelcomeMessages(starCount, hotelName);

    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showCalloutBubble, setShowCalloutBubble] = useState(false);
    const [selectedLang, setSelectedLang] = useState('vi');
    const [messages, setMessages] = useState(() => {
        try {
            const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Lỗi đọc chat history từ sessionStorage:', e);
        }
        return [{
            id: 'welcome-1',
            role: 'model',
            detected_lang: 'vi',
            text: welcomeMessages.vi,
            time: 'Bây giờ'
        }];
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
        } catch (e) {
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

    // Tự động đóng bong bóng khi người dùng mở Chatbot
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
        } catch (err) {
            // ignore
        }
    };

    // Voice AI States (Web Speech API: STT & TTS)
    const [speakingMsgId, setSpeakingMsgId] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [voiceError, setVoiceError] = useState(null);
    const [availableVoices, setAvailableVoices] = useState([]);
    
    const chatContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const langDropdownRef = useRef(null);
    const recognitionRef = useRef(null);

    // Tải trước danh sách Voice cho Text-to-Speech
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

    // Cleanup khi component unmount
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    // ignore
                }
            }
        };
    }, []);

    // Dừng đọc và dừng thu âm khi người dùng đóng Chat Widget
    useEffect(() => {
        if (!isOpen) {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                setSpeakingMsgId(null);
            }
            if (recognitionRef.current && isListening) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // ignore
                }
                setIsListening(false);
            }
        }
    }, [isOpen]);

    // Hàm đọc câu trả lời của Bot bằng Text-to-Speech tự nhiên
    const toggleSpeakMessage = (msg) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            const dict = I18N_DICT[selectedLang] || I18N_DICT.vi;
            alert(dict.voice_not_supported || 'Trình duyệt không hỗ trợ Text-to-Speech.');
            return;
        }

        // Nếu tin nhắn này đang được đọc thì bấm lần 2 để dừng
        if (speakingMsgId === msg.id) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
            return;
        }

        // Dừng câu nói trước đó (nếu có)
        window.speechSynthesis.cancel();

        const cleanedText = cleanTextForSpeech(msg.text);
        if (!cleanedText) return;

        const utterance = new SpeechSynthesisUtterance(cleanedText);
        const targetLang = msg.detected_lang || selectedLang || 'vi';
        const targetLangCode = SPEECH_LANG_MAP[targetLang] || 'vi-VN';
        utterance.lang = targetLangCode;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Chọn giọng đọc phù hợp với ngôn ngữ đã phát hiện
        const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
            const matchedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-') === targetLangCode.toLowerCase()) ||
                                 voices.find(v => v.lang.toLowerCase().startsWith(targetLang.toLowerCase())) ||
                                 voices.find(v => v.lang.toLowerCase().startsWith(targetLangCode.slice(0, 2).toLowerCase()));
            if (matchedVoice) {
                utterance.voice = matchedVoice;
            }
        }

        utterance.onstart = () => {
            setSpeakingMsgId(msg.id);
        };

        utterance.onend = () => {
            setSpeakingMsgId(null);
        };

        utterance.onerror = (e) => {
            console.warn('Speech synthesis error:', e);
            setSpeakingMsgId(null);
        };

        window.speechSynthesis.speak(utterance);
    };

    // Hàm thu âm giọng nói câu hỏi của khách (Speech-to-Text)
    const toggleVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            const dict = I18N_DICT[selectedLang] || I18N_DICT.vi;
            alert(dict.voice_not_supported);
            return;
        }

        // Nếu đang lắng nghe thì bấm để dừng lại
        if (isListening && recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // ignore
            }
            setIsListening(false);
            return;
        }

        // Tạm dừng đọc giọng nói bot trước khi nghe khách
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
                console.warn('Speech recognition error:', event.error);
                setIsListening(false);
                const dict = I18N_DICT[selectedLang] || I18N_DICT.vi;
                if (event.error === 'not-allowed') {
                    setVoiceError(dict.voice_denied);
                    setTimeout(() => setVoiceError(null), 4000);
                } else if (event.error === 'audio-capture') {
                    setVoiceError(selectedLang === 'en' ? 'No microphone detected on this device.' : 'Không tìm thấy thiết bị Microphone trên máy tính.');
                    setTimeout(() => setVoiceError(null), 4000);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
        } catch (err) {
            console.error('Không thể bật nhận diện giọng nói:', err);
            setIsListening(false);
        }
    };

    // Đóng dropdown ngôn ngữ khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(e) {
            if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
                setShowLangDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Tự động cuộn xuống tin nhắn mới nhất
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

    // Cuộn lên đầu để xem tin nhắn chào mừng từ đầu
    const scrollToTop = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = 0;
        }
    };

    useEffect(() => {
        if (isOpen) {
            setHasUnread(false);
            if (messages.length <= 1) {
                // Khi mở chatbot và chỉ có tin nhắn chào mừng: Luôn hiển thị từ đầu lời chào (không cuộn tụt xuống đáy)
                scrollToTop();
                requestAnimationFrame(() => scrollToTop());
                setTimeout(() => scrollToTop(), 50);
            } else {
                // Nếu đã có cuộc hội thoại trước đó: Cuộn xuống tin nhắn gần nhất
                scrollToBottom(false);
            }
            setTimeout(() => {
                inputRef.current?.focus({ preventScroll: true });
            }, 100);
        }
    }, [isOpen]);

    useEffect(() => {
        // Lưu lịch sử vào sessionStorage
        try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
        } catch (e) {
            console.error('Lỗi ghi chat history vào sessionStorage:', e);
        }

        if (isOpen) {
            if (messages.length <= 1) {
                scrollToTop();
                requestAnimationFrame(() => scrollToTop());
                setTimeout(() => scrollToTop(), 50);
            } else {
                scrollToBottom(true);
            }
        }
    }, [messages]);

    useEffect(() => {
        if (isLoading && isOpen) {
            scrollToBottom(true);
        }
    }, [isLoading, isOpen]);

    // Chuyển đổi ngôn ngữ thủ công bởi người dùng
    const handleSwitchLang = (langCode) => {
        setSelectedLang(langCode);
        // Nếu cuộc trò chuyện chỉ có 1 lời chào ban đầu, cập nhật lời chào theo ngôn ngữ mới
        if (messages.length === 1 && messages[0].id.startsWith('welcome')) {
            const welcomeText = welcomeMessages[langCode] || welcomeMessages.vi;
            setMessages([{
                ...messages[0],
                detected_lang: langCode,
                text: welcomeText
            }]);
        }
    };

    // Gửi tin nhắn
    const handleSendMessage = async (textToSend) => {
        const query = (textToSend || inputValue).trim();
        if (!query || isLoading) return;

        // Dừng giọng nói bot và tắt micro khi bắt đầu gửi tin
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setSpeakingMsgId(null);
        }
        if (recognitionRef.current && isListening) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
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
            // Chuẩn bị 5 tin nhắn gần nhất làm context history
            const history = updatedMessages
                .slice(-6, -1)
                .map(m => ({
                    role: m.role === 'model' ? 'model' : 'user',
                    text: m.text
                }));

            const data = await askChatbot(query, history);

            const botTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const botReplyText = data?.reply || 'Dạ em xin lỗi Quý khách, hệ thống đang bận một chút. Quý khách vui lòng thử lại hoặc liên hệ Hotline 1900 8899 để được hỗ trợ tức thì ạ!';
            const detectedLang = data?.detected_lang || selectedLang || 'vi';

            if (data?.detected_lang && ['vi', 'en', 'ko', 'zh'].includes(data.detected_lang)) {
                setSelectedLang(data.detected_lang);
            }

            const botMsg = {
                id: `bot-${Date.now()}`,
                role: 'model',
                text: botReplyText,
                time: botTime,
                source: data?.source || 'ai',
                detected_lang: detectedLang,
                suggested_rooms: Array.isArray(data?.suggested_rooms) ? data.suggested_rooms : [],
                suggested_services: Array.isArray(data?.suggested_services) ? data.suggested_services : [],
                tracked_bookings: Array.isArray(data?.tracked_bookings) ? data.tracked_bookings : []
            };

            setMessages(prev => [...prev, botMsg]);

            if (!isOpen) {
                setHasUnread(true);
            }
        } catch (error) {
            console.error('Lỗi khi gọi API Chatbot:', error);
            const errorMsg = {
                id: `error-${Date.now()}`,
                role: 'model',
                detected_lang: selectedLang,
                text: selectedLang === 'en' 
                    ? 'I apologize for the temporary interruption. Please contact our 24/7 Concierge Hotline at **1900 8899** for immediate assistance!'
                    : selectedLang === 'ko'
                    ? '일시적인 네트워크 지연이 발생했습니다. 24시간 컨시어지 핫라인 **1900 8899**로 연락 주시면 즉시 도와드리겠습니다!'
                    : selectedLang === 'zh'
                    ? '抱歉系统连接暂时受阻。请致电24小时前台热线 **1900 8899** 获取即时帮助！'
                    : 'Dạ em xin lỗi Quý khách! Kết nối của em đang gặp gián đoạn tạm thời. Quý khách vui lòng liên hệ trực tiếp Hotline lễ tân 24/7 **1900 8899** để được chuyên viên hỗ trợ ngay ạ!',
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // Mở hộp thoại xác nhận làm mới cuộc trò chuyện trong widget (không dùng window.confirm)
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
            } catch (e) {
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
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (e) {
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
        <aside aria-label="Khung trò chuyện Trợ lý AI Khách Sạn TA Đà Nẵng">
            {/* 1. NÚT MỞ CHAT NỔI (FLOATING BUTTON) TÔNG SÁNG TRANG NHÃ DỊU MẮT & BONG BÓNG CHÀO ĐÓN */}
            <div className={`fixed z-50 select-none flex flex-col items-end ${hasMobileStickyBar ? 'bottom-20 right-4 sm:bottom-6 sm:right-6' : 'bottom-4 right-4 sm:bottom-6 sm:right-6'}`}>
                {/* Bong bóng chào đón thông minh (Proactive Callout Bubble) */}
                {showCalloutBubble && !isOpen && (
                    <div 
                        onClick={() => {
                            setIsOpen(true);
                            setShowCalloutBubble(false);
                        }}
                        className="mb-3.5 p-3.5 sm:p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-amber-300/90 shadow-[0_15px_35px_-5px_rgba(217,119,6,0.28)] text-slate-800 max-w-[280px] sm:max-w-[320px] cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-400 group relative hover:border-amber-400 transition-all select-none"
                        role="region"
                        aria-label="Thông điệp chào mừng từ Trợ lý AI"
                    >
                        {/* Mũi tên trỏ xuống dưới góc phải */}
                        <div className="absolute -bottom-2 right-8 sm:right-10 w-4 h-4 bg-white/95 border-b border-r border-amber-300/90 rotate-45 transform" />

                        {/* Header bong bóng */}
                        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-amber-100">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
                                    Trợ Lý AI {starCount}★
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleDismissBubble}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Đóng thông báo"
                                aria-label="Đóng thông điệp chào mừng"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Lời chào cá nhân hóa */}
                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                            👋 Kính chào {user?.full_name ? <strong className="text-amber-900 font-bold">{user.full_name}</strong> : 'Quý khách'}! 
                            <br />
                            Em có thể hỗ trợ Quý khách <span className="text-amber-800 font-semibold">tra cứu phòng giá ưu đãi hôm nay</span> hoặc giải đáp dịch vụ không ạ?
                        </p>

                        {/* Gợi ý nhanh 1 chạm */}
                        <div className="mt-2.5 pt-2 flex flex-wrap gap-1.5 border-t border-amber-50">
                            <span 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(true);
                                    setShowCalloutBubble(false);
                                    handleQuickAsk('Cho tôi biết các phòng trống và giá hôm nay');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 shadow-2xs transition-all active:scale-95"
                            >
                                🏨 Giá phòng hôm nay
                            </span>
                            <span 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(true);
                                    setShowCalloutBubble(false);
                                    handleQuickAsk('Giới thiệu các dịch vụ ăn uống và tiện ích');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all active:scale-95"
                            >
                                🍽️ Menu dịch vụ
                            </span>
                        </div>
                    </div>
                )}

                {/* Nút Floating Button chính */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`relative group flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full 
                        bg-white/95 backdrop-blur-md text-slate-800 font-medium shadow-xl
                        border-2 border-amber-300 hover:border-amber-400 hover:bg-amber-50/40
                        transition-all duration-300 ease-out cursor-pointer
                        hover:scale-105 active:scale-95
                        shadow-[0_10px_30px_-5px_rgba(217,119,6,0.28)]`}
                    title={`Trợ Lý Ảo AI - ${hotelName} ${starCount}★ (Multilingual Concierge)`}
                    aria-expanded={isOpen}
                    aria-label={`Mở khung trò chuyện với Trợ lý AI ${starCount} sao`}
                >
                    {/* Hiệu ứng hào quang Vàng Gold dịu nhẹ */}
                    <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-200 opacity-25 blur group-hover:opacity-45 transition duration-500 animate-pulse" />

                    {/* Hiệu ứng vệt sáng ánh kim lướt qua (Shimmer) */}
                    <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                        <span className="absolute -inset-full top-0 bg-gradient-to-r from-transparent via-white/50 to-transparent transform -skew-x-12 group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                    </span>

                    {/* Khối nội dung chính của Nút */}
                    <div className="relative flex items-center gap-2.5">
                        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-200 text-amber-950 font-bold shadow-xs">
                            <Sparkles className="w-4 h-4 text-amber-900 animate-spin" style={{ animationDuration: '8s' }} />
                        </div>

                        <div className="hidden sm:flex flex-col text-left">
                            <span className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                                Trợ Lý AI {starCount}★
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-normal">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                Online 24/7
                            </span>
                        </div>

                        {/* Nút icon mũi tên / đóng */}
                        <div className="text-amber-700 pl-0.5 flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 group-hover:bg-amber-100/90 border border-amber-200/80 transition-colors">
                            {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-amber-700" />
                            ) : (
                                <MessageSquare className="w-4 h-4 text-amber-700" />
                            )}
                        </div>
                    </div>

                    {/* Huy hiệu tin nhắn mới chưa đọc */}
                    {hasUnread && !isOpen && (
                        <span className="absolute -top-1.5 -left-1.5 flex h-4 w-4">
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
                    className={`fixed z-50 flex flex-col rounded-2xl bg-white shadow-2xl border border-amber-200/80 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300 ${
                        hasMobileStickyBar
                            ? 'inset-x-2.5 bottom-20 top-16 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[610px] sm:max-h-[85vh]'
                            : 'inset-x-2.5 bottom-2.5 top-16 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[610px] sm:max-h-[85vh]'
                    }`}
                    style={{
                        boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.12), 0 0 20px 2px rgba(245, 158, 11, 0.08)'
                    }}
                >
                    {/* A. HEADER TÔNG VÀNG CHAMPAGNE & TRẮNG NGÀ NHẸ NHÀNG, DỊU MẮT */}
                    <header className="bg-gradient-to-r from-amber-50/95 via-[#fdfbf7] to-amber-100/60 text-slate-800 px-3.5 py-2.5 border-b border-amber-200/80 flex items-center justify-between shadow-xs select-none">
                        {/* Bên trái: Avatar + Tên trợ lý và trạng thái (Không bao giờ rớt dòng) */}
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex-shrink-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-200 p-0.5 shadow-xs">
                                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-amber-800 font-serif font-black text-sm">
                                        TA
                                    </div>
                                </div>
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="text-sm font-bold text-slate-800 tracking-tight font-sans m-0 whitespace-nowrap">
                                        Trợ Lý AI {starCount}★
                                    </h2>
                                    <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-semibold tracking-wider flex-shrink-0 uppercase">
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

                        {/* Bên phải: Nút điều khiển (Ngôn ngữ + Làm mới + Đóng) */}
                        <div className="flex items-center gap-1 flex-shrink-0" ref={langDropdownRef}>
                            {/* Nút chọn ngôn ngữ tinh gọn */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-white/95 hover:bg-amber-100/80 text-slate-700 border border-amber-200/90 shadow-2xs transition-all cursor-pointer active:scale-95"
                                    title="Chọn ngôn ngữ / Select language"
                                    aria-label="Chọn ngôn ngữ giao tiếp"
                                >
                                    <span className="text-sm leading-none">{SUPPORTED_LANGS.find(l => l.code === selectedLang)?.flag}</span>
                                    <span className="font-bold text-[11px] text-amber-900">{selectedLang.toUpperCase()}</span>
                                    <ChevronDown className="w-3 h-3 text-amber-700" />
                                </button>
                                
                                {showLangDropdown && (
                                    <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-amber-200 py-1 z-30 animate-in fade-in zoom-in-95">
                                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                            Ngôn ngữ / Language
                                        </div>
                                        {SUPPORTED_LANGS.map(lang => (
                                            <button
                                                key={lang.code}
                                                onClick={() => {
                                                    handleSwitchLang(lang.code);
                                                    setShowLangDropdown(false);
                                                }}
                                                className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between hover:bg-amber-50 transition-colors cursor-pointer ${
                                                    selectedLang === lang.code ? 'font-bold text-amber-900 bg-amber-50/80' : 'text-slate-700'
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span>{lang.flag}</span>
                                                    <span>{lang.label}</span>
                                                </span>
                                                {selectedLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleResetChat}
                                className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-100/70 rounded-lg transition-colors cursor-pointer"
                                title="Làm mới cuộc trò chuyện"
                                aria-label="Làm mới cuộc trò chuyện"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-amber-100/70 rounded-lg transition-colors cursor-pointer"
                                title="Thu nhỏ khung chat"
                                aria-label="Thu nhỏ khung chat"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </header>

                    {/* HỘP THOẠI XÁC NHẬN LÀM MỚI TINH TẾ NGAY TRONG WIDGET */}
                    {showResetConfirm && (
                        <div className="bg-amber-50/95 border-b border-amber-200/90 px-3.5 py-2.5 flex items-center justify-between text-xs text-amber-900 animate-in fade-in slide-in-from-top-1 duration-200">
                            <span className="font-medium flex items-center gap-1.5 text-slate-700">
                                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                Làm mới toàn bộ cuộc trò chuyện?
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={confirmResetChat}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer shadow-xs active:scale-95"
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

                    {/* C. KHUNG HIỂN THỊ TIN NHẮN (MESSAGES STREAM - TOÀN BỘ KHÔNG GIAN) */}
                    <div 
                        ref={chatContainerRef}
                        className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-gradient-to-b from-slate-50/50 to-white"
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

                            // Ngôn ngữ của tin nhắn
                            const msgLang = msg.detected_lang || selectedLang || 'vi';
                            const dict = I18N_DICT[msgLang] || I18N_DICT.vi;

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
                                >
                                    {isBot && (
                                        <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex-shrink-0 flex items-center justify-center text-xs shadow-xs mt-0.5">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}

                                    <div
                                        className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] shadow-xs ${
                                            isBot
                                                ? `bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] ${hasSuggestions ? 'w-full max-w-[94%] sm:max-w-[92%]' : 'max-w-[85%]'}`
                                                : 'bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-tr-xs shadow-md shadow-amber-600/20 max-w-[85%]'
                                        }`}
                                    >
                                        <div className="whitespace-pre-wrap leading-relaxed">
                                            {isBot ? renderFormattedContent(msg.text) : msg.text}
                                        </div>

                                        {/* CÁC GỢI Ý HỎI NHANH 1 CHẠM NẰM TRONG BONG BÓNG CHÀO MỪNG (Scroll tự nhiên theo tin nhắn, không ghim chiếm chỗ màn hình) */}
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
                                                    {currentChips.map(chip => (
                                                        <button
                                                            key={chip.id}
                                                            onClick={() => handleSendMessage(chip.query)}
                                                            disabled={isLoading}
                                                            className="text-left text-[11px] p-2 rounded-xl bg-amber-50/70 hover:bg-amber-100/90 border border-amber-200/90 text-slate-800 font-medium transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                                                        >
                                                            {chip.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* THẺ TIẾN TRÌNH ĐƠN ĐẶT PHÒNG THỜI GIAN THỰC (BOOKING PROGRESS TRACKER) */}
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
                                                    const currentStep = bk.step_index; // 1: Giữ chỗ, 2: Xác nhận, 3: Lưu trú, 4: Hoàn tất

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
                                                            {/* Header: Mã đơn + Huy hiệu trạng thái */}
                                                            <div className="flex items-center justify-between border-b border-amber-100/80 pb-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono font-bold text-amber-900 text-xs tracking-wider">
                                                                        #{bk.booking_code}
                                                                    </span>
                                                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                                                                        {starCount}★ TA
                                                                    </span>
                                                                </div>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1 ${
                                                                    isCancelled 
                                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                                                        : currentStep === 3
                                                                        ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse'
                                                                        : currentStep === 4
                                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                                }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                                        isCancelled ? 'bg-rose-500' : currentStep === 3 ? 'bg-blue-600' : currentStep === 4 ? 'bg-emerald-600' : 'bg-amber-500'
                                                                    }`} />
                                                                    {bk.status_label}
                                                                </span>
                                                            </div>

                                                            {/* Chi tiết đặt phòng */}
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

                                                            {/* Timeline 4 bước trực quan */}
                                                            {!isCancelled ? (
                                                                <div className="mt-3 pt-2.5 border-t border-slate-100">
                                                                    <div className="relative flex items-center justify-between px-3">
                                                                        {/* Đường kẻ nền */}
                                                                        <div className="absolute left-6 right-6 top-3 h-0.5 bg-slate-200 z-0" />
                                                                        
                                                                        {/* Đường kẻ tiến trình xanh kết nối */}
                                                                        <div 
                                                                            className="absolute left-6 top-3 h-0.5 bg-emerald-500 transition-all duration-500 z-0"
                                                                            style={{
                                                                                width: `${Math.max(0, Math.min(100, ((currentStep - 1) / 3) * 100))}%`
                                                                            }}
                                                                        />

                                                                        {steps.map((st) => {
                                                                            const IconComp = st.icon;
                                                                            const isDone = currentStep >= st.num;
                                                                            const isCurrent = currentStep === st.num;

                                                                            return (
                                                                                <div key={st.num} className="relative z-10 flex flex-col items-center">
                                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                                                                                        isCurrent
                                                                                            ? 'bg-amber-600 text-white ring-4 ring-amber-100 scale-110 shadow-xs'
                                                                                            : isDone
                                                                                            ? 'bg-emerald-500 text-white shadow-xs'
                                                                                            : 'bg-white border-2 border-slate-300 text-slate-400'
                                                                                    }`}>
                                                                                        <IconComp className="w-3 h-3" />
                                                                                    </div>
                                                                                    <span className={`text-[9px] mt-1 font-medium ${
                                                                                        isCurrent ? 'text-amber-800 font-bold' : isDone ? 'text-slate-700 font-medium' : 'text-slate-400'
                                                                                    }`}>
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

                                                            {/* Nút hành động nhanh */}
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
                                                                    href="tel:19008899"
                                                                    className="py-1.5 px-3 text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
                                                                    title="Gọi Hotline hỗ trợ lễ tân 24/7"
                                                                >
                                                                    <Phone className="w-3 h-3 text-slate-500" />
                                                                    {dict.hotline_call}
                                                                </a>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Gợi ý Thẻ phòng tương tác (Interactive Room Cards với giá song song VND + USD/KRW/CNY) */}
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
                                                    className="flex gap-2.5 overflow-x-auto pb-2.5 pt-0.5 scroll-smooth -mx-1 px-1"
                                                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                                                >
                                                    {msg.suggested_rooms.map((room) => {
                                                        const isAvailable = room.available_count > 0;
                                                        return (
                                                            <div 
                                                                key={room.id}
                                                                className="w-[220px] flex-shrink-0 bg-white rounded-xl border border-amber-200/90 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group"
                                                            >
                                                                {/* Ảnh phòng & Huy hiệu trạng thái */}
                                                                <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                                                                    <img 
                                                                        src={room.image_url} 
                                                                        alt={room.name}
                                                                        loading="lazy"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80';
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
                                                                </div>

                                                                {/* Thông tin phòng & Giá song song */}
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

                                                                    {/* 2 Nút hành động trực tiếp đa ngôn ngữ */}
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
                                                                                    navigate(`/checkout/${room.id}`);
                                                                                }
                                                                            }}
                                                                            disabled={!isAvailable}
                                                                            className={`flex-1 py-1.5 px-1 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                                                                                isAvailable
                                                                                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-xs active:scale-95'
                                                                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                                            }`}
                                                                            title={isAvailable ? "Đặt phòng này ngay" : "Phòng hiện đã kín"}
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

                                        {/* Gợi ý Thẻ dịch vụ tương tác (Interactive Service Cards) */}
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
                                                    className="flex gap-2.5 overflow-x-auto pb-2.5 pt-0.5 scroll-smooth -mx-1 px-1"
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
                                                                        e.target.src = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80';
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
                                                                        navigate('/services');
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

                                        <div
                                            className={`text-[10px] mt-2 flex items-center justify-between gap-1 pt-1.5 border-t ${
                                                isBot ? 'text-slate-400 border-slate-100' : 'text-amber-100/80 border-amber-600/30'
                                            }`}
                                        >
                                            {isBot ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSpeakMessage(msg)}
                                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                                        speakingMsgId === msg.id
                                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                                                            : 'text-slate-500 hover:text-amber-800 hover:bg-amber-50/80 border border-slate-200/60 hover:border-amber-300'
                                                    }`}
                                                    title={speakingMsgId === msg.id ? dict.stop_speak : dict.speak_btn}
                                                    aria-label={speakingMsgId === msg.id ? dict.stop_speak : dict.speak_btn}
                                                >
                                                    {speakingMsgId === msg.id ? (
                                                        <>
                                                            <VolumeX className="w-3 h-3 text-amber-700" />
                                                            <span className="font-semibold text-amber-900">{dict.stop_speak}</span>
                                                            <span className="flex items-center gap-0.5 ml-0.5">
                                                                <span className="w-0.5 h-2 bg-amber-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                                <span className="w-0.5 h-3 bg-amber-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                                <span className="w-0.5 h-1.5 bg-amber-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Volume2 className="w-3 h-3 text-slate-500" />
                                                            <span>{dict.speak_btn}</span>
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <span />
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

                    {/* THANH GỢI Ý 1 HÀNG MỎNG LƯỚT NGANG PHÍA TRÊN Ô NHẬP (Chỉ chiếm ~30px) */}
                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200/70 flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 flex-shrink-0">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Gợi ý:
                        </span>
                        {currentChips.map(chip => (
                            <button
                                key={chip.id}
                                onClick={() => handleSendMessage(chip.query)}
                                disabled={isLoading}
                                className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 font-medium transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* BANNER THU ÂM GIỌNG NÓI (VOICE AI LISTENING) */}
                    {isListening && (
                        <div className="px-3 py-2 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-700 font-medium animate-fadeIn">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                                </span>
                                <span className="text-[11px] font-semibold text-rose-800">
                                    {currentDict.voice_listening}
                                </span>
                                <span className="flex items-center gap-0.5 ml-1">
                                    <span className="w-0.5 h-2 bg-rose-500 animate-pulse" style={{ animationDuration: '600ms' }} />
                                    <span className="w-0.5 h-3.5 bg-rose-600 animate-pulse" style={{ animationDuration: '400ms' }} />
                                    <span className="w-0.5 h-2.5 bg-rose-500 animate-pulse" style={{ animationDuration: '500ms' }} />
                                    <span className="w-0.5 h-4 bg-rose-600 animate-pulse" style={{ animationDuration: '300ms' }} />
                                </span>
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

                    {/* D. KHUNG NHẬP CÂU HỎI (INPUT AREA) */}
                    <div className="p-3 bg-white border-t border-slate-200">
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
                                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 
                                    placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 
                                    transition-all disabled:opacity-50"
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
                                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/90 shadow-2xs hover:shadow-xs active:scale-95'
                                }`}
                                title={isListening ? currentDict.voice_stop : 'Bấm để nói câu hỏi bằng Micro (Voice AI)'}
                                aria-label="Nói câu hỏi bằng Micro"
                            >
                                {isListening ? (
                                    <MicOff className="w-4 h-4 text-white" />
                                ) : (
                                    <Mic className="w-4 h-4 text-amber-700" />
                                )}
                            </button>

                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isLoading}
                                className={`p-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer flex items-center justify-center ${
                                    inputValue.trim() && !isLoading
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs active:scale-95 border border-amber-500'
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
