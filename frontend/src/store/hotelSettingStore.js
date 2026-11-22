import { useSyncExternalStore, useEffect } from 'react';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';

export const DEFAULT_BANNERS = {
    banner_home: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80',
    banner_home_2: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=2070&q=90',
    banner_home_3: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1920&q=80',
    banner_rooms: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=2074&q=85',
    banner_services: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2070&q=85',
    banner_promotions: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    banner_news: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85',
    banner_contact: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=90',
    banner_corporate: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    banner_login: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2070&q=85',
    gallery_pool: 'https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=1400&q=85',
    gallery_spa: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1000&q=85',
    gallery_dining: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=85',
    gallery_beach: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=85',
    concierge_dining_img: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=600&q=80',
    concierge_spa_img: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=600&q=80',
};

let latestFaviconToken = 0;

function setFaviconElement(href, type = '') {
    if (typeof document === 'undefined' || !href) return;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    if (type) {
        link.type = type;
    } else {
        link.removeAttribute('type');
    }
    link.href = href;
}

export function applyFavicon(faviconUrl) {
    if (!faviconUrl || typeof document === 'undefined') return;
    const token = ++latestFaviconToken;

    // Nếu đã là data URL hoặc SVG thì gắn trực tiếp
    if (faviconUrl.startsWith('data:') || /\.svg(\?|$)/i.test(faviconUrl)) {
        setFaviconElement(faviconUrl, /\.svg(\?|$)/i.test(faviconUrl) ? 'image/svg+xml' : '');
        return;
    }

    // Tự động cắt vuông giữa (tránh bóp dẹt ảnh ngang) và bo tròn nền trong suốt 4 góc bằng Canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        if (token !== latestFaviconToken) return;
        try {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setFaviconElement(faviconUrl);
                return;
            }

            ctx.clearRect(0, 0, size, size);
            ctx.save();
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);

            const natW = img.naturalWidth || img.width || size;
            const natH = img.naturalHeight || img.height || size;
            const cropSide = Math.min(natW, natH);
            const sx = (natW - cropSide) / 2;
            const sy = (natH - cropSide) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, size, size);
            ctx.restore();

            const circularPng = canvas.toDataURL('image/png');
            setFaviconElement(circularPng, 'image/png');
        } catch {
            // Fallback an toàn nếu nguồn ảnh ngoài không bật CORS
            setFaviconElement(faviconUrl);
        }
    };
    img.onerror = () => {
        if (token !== latestFaviconToken) return;
        setFaviconElement(faviconUrl);
    };

    const sep = faviconUrl.includes('?') ? '&' : '?';
    img.src = `${faviconUrl}${sep}fav_cors=1`;
}

export function getFormattedHotelSlogan(settings) {
    const stars = Number(settings?.stars) || 3;
    let slogan = settings?.hotel_slogan;
    if (slogan && slogan.trim()) {
        slogan = slogan.replace(/\b\d+[- ]*(?:Star|star)\b/gi, `${stars}-Star`)
                       .replace(/\b\d+[- ]*(?:Sao|sao)\b/gi, `${stars} Sao`);
    } else {
        slogan = `${stars}-Star Luxury Resort & Hotel`;
    }
    return slogan;
}

export function applyDocumentTitle(settings) {
    if (typeof document === 'undefined') return;
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const slogan = getFormattedHotelSlogan(settings);
    document.title = `${hotelName} | ${slogan}`;
}

let listeners = [];
let currentSettings = {
    hotel_name: 'Khách Sạn TA Đà Nẵng',
    hotel_slogan: 'Luxury Resort & Hotel',
    stars: 3,
    address: '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
    hotline: '1900 8899',
    phone_number: '+84 (0) 236 388 9900',
    email: 'contact@tahotel.vn',
    website: 'https://tahotel.vn',
    tax_code: '0401234567',
    description: 'Kiệt tác nghỉ dưỡng giao hòa giữa vẻ đẹp di sản truyền thống và kiến trúc hiện đại chuẩn quốc tế. Nơi tái định nghĩa chuẩn mực sang trọng và sự thư thái tinh khiết.',
    logo_url: '',
    favicon_url: '',
    banner_home: DEFAULT_BANNERS.banner_home,
    banner_home_2: DEFAULT_BANNERS.banner_home_2,
    banner_home_3: DEFAULT_BANNERS.banner_home_3,
    banner_rooms: DEFAULT_BANNERS.banner_rooms,
    banner_services: DEFAULT_BANNERS.banner_services,
    banner_promotions: DEFAULT_BANNERS.banner_promotions,
    banner_news: DEFAULT_BANNERS.banner_news,
    banner_contact: DEFAULT_BANNERS.banner_contact,
    banner_corporate: DEFAULT_BANNERS.banner_corporate,
    banner_login: DEFAULT_BANNERS.banner_login,
    gallery_pool: DEFAULT_BANNERS.gallery_pool,
    gallery_spa: DEFAULT_BANNERS.gallery_spa,
    gallery_dining: DEFAULT_BANNERS.gallery_dining,
    gallery_beach: DEFAULT_BANNERS.gallery_beach,
    concierge_dining_img: DEFAULT_BANNERS.concierge_dining_img,
    concierge_spa_img: DEFAULT_BANNERS.concierge_spa_img,
    check_in_time: '14:00',
    check_out_time: '12:00',
    isLoaded: false
};

let isFetching = false;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

export const hotelSettingStore = {
    getSnapshot() {
        return currentSettings;
    },
    subscribe(listener) {
        listeners.push(listener);
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    },
    updateSettings(newData) {
        if (!newData) return;
        currentSettings = {
            ...currentSettings,
            ...newData,
            logo_url: resolveMediaUrl(newData.logo_url, currentSettings.logo_url),
            favicon_url: resolveMediaUrl(newData.favicon_url, currentSettings.favicon_url),
            banner_home: resolveMediaUrl(newData.banner_home, DEFAULT_BANNERS.banner_home),
            banner_home_2: resolveMediaUrl(newData.banner_home_2, DEFAULT_BANNERS.banner_home_2),
            banner_home_3: resolveMediaUrl(newData.banner_home_3, DEFAULT_BANNERS.banner_home_3),
            banner_rooms: resolveMediaUrl(newData.banner_rooms, DEFAULT_BANNERS.banner_rooms),
            banner_services: resolveMediaUrl(newData.banner_services, DEFAULT_BANNERS.banner_services),
            banner_promotions: resolveMediaUrl(newData.banner_promotions, DEFAULT_BANNERS.banner_promotions),
            banner_news: resolveMediaUrl(newData.banner_news, DEFAULT_BANNERS.banner_news),
            banner_contact: resolveMediaUrl(newData.banner_contact, DEFAULT_BANNERS.banner_contact),
            banner_corporate: resolveMediaUrl(newData.banner_corporate, DEFAULT_BANNERS.banner_corporate),
            banner_login: resolveMediaUrl(newData.banner_login, DEFAULT_BANNERS.banner_login),
            gallery_pool: resolveMediaUrl(newData.gallery_pool, DEFAULT_BANNERS.gallery_pool),
            gallery_spa: resolveMediaUrl(newData.gallery_spa, DEFAULT_BANNERS.gallery_spa),
            gallery_dining: resolveMediaUrl(newData.gallery_dining, DEFAULT_BANNERS.gallery_dining),
            gallery_beach: resolveMediaUrl(newData.gallery_beach, DEFAULT_BANNERS.gallery_beach),
            concierge_dining_img: resolveMediaUrl(newData.concierge_dining_img, DEFAULT_BANNERS.concierge_dining_img),
            concierge_spa_img: resolveMediaUrl(newData.concierge_spa_img, DEFAULT_BANNERS.concierge_spa_img),
            isLoaded: true
        };
        if (currentSettings.favicon_url) {
            applyFavicon(currentSettings.favicon_url);
        }
        applyDocumentTitle(currentSettings);
        emitChange();
    },
    async fetchSettings(force = false) {
        if (currentSettings.isLoaded && !force) return currentSettings;
        if (isFetching) return currentSettings;
        isFetching = true;
        try {
            const res = await api.get('/hotel-settings/');
            const data = res.data?.data || res.data;
            if (data) {
                this.updateSettings(data);
            } else {
                currentSettings.isLoaded = true;
                applyDocumentTitle(currentSettings);
            }
        } catch (e) {
            console.error('Lỗi khi tải cấu hình khách sạn:', e);
            currentSettings.isLoaded = true;
            applyDocumentTitle(currentSettings);
        } finally {
            isFetching = false;
        }
        return currentSettings;
    }
};

applyDocumentTitle(currentSettings);

export function useHotelSettings() {
    const settings = useSyncExternalStore(
        hotelSettingStore.subscribe,
        hotelSettingStore.getSnapshot
    );

    // Tự động tải nếu chưa được tải lần đầu (chạy an toàn trong useEffect, không gọi trong render body)
    useEffect(() => {
        if (!settings.isLoaded && !isFetching) {
            hotelSettingStore.fetchSettings();
        }
    }, [settings.isLoaded]);

    return {
        settings,
        refetch: () => hotelSettingStore.fetchSettings(true),
        updateSettings: (data) => hotelSettingStore.updateSettings(data),
    };
}

export default hotelSettingStore;
