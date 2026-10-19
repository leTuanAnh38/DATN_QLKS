import { useSyncExternalStore } from 'react';
import api from '../services/api';

export const DEFAULT_BANNERS = {
    banner_home: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80',
    banner_home_2: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1920&q=80',
    banner_home_3: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1920&q=80',
    banner_rooms: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=2074&q=85',
    banner_services: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2070&q=85',
    banner_promotions: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    banner_news: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85',
    banner_contact: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=90',
    banner_corporate: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
};

export function applyFavicon(faviconUrl) {
    if (!faviconUrl || typeof document === 'undefined') return;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.head.appendChild(link);
    }
    link.href = faviconUrl;
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
            banner_home: newData.banner_home || DEFAULT_BANNERS.banner_home,
            banner_home_2: newData.banner_home_2 || DEFAULT_BANNERS.banner_home_2,
            banner_home_3: newData.banner_home_3 || DEFAULT_BANNERS.banner_home_3,
            banner_rooms: newData.banner_rooms || DEFAULT_BANNERS.banner_rooms,
            banner_services: newData.banner_services || DEFAULT_BANNERS.banner_services,
            banner_promotions: newData.banner_promotions || DEFAULT_BANNERS.banner_promotions,
            banner_news: newData.banner_news || DEFAULT_BANNERS.banner_news,
            banner_contact: newData.banner_contact || DEFAULT_BANNERS.banner_contact,
            banner_corporate: newData.banner_corporate || DEFAULT_BANNERS.banner_corporate,
            isLoaded: true
        };
        if (currentSettings.favicon_url) {
            applyFavicon(currentSettings.favicon_url);
        }
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
            }
        } catch (e) {
            console.error('Lỗi khi tải cấu hình khách sạn:', e);
        } finally {
            isFetching = false;
        }
        return currentSettings;
    }
};

export function useHotelSettings() {
    const settings = useSyncExternalStore(
        hotelSettingStore.subscribe,
        hotelSettingStore.getSnapshot
    );

    // Tự động tải nếu chưa được tải lần đầu
    if (!settings.isLoaded && !isFetching) {
        hotelSettingStore.fetchSettings();
    }

    return {
        settings,
        refetch: () => hotelSettingStore.fetchSettings(true),
        updateSettings: (data) => hotelSettingStore.updateSettings(data),
    };
}

export default hotelSettingStore;
