import { useSyncExternalStore } from 'react';

// Keys lưu trong LocalStorage
const USER_KEY = 'ta_hotel_user';
const ACCESS_TOKEN_KEY = 'ta_hotel_access_token';
const REFRESH_TOKEN_KEY = 'ta_hotel_refresh_token';

// In-memory state cache
let currentUser = null;
let currentAccessToken = null;
let currentRefreshToken = null;

try {
    const rawUser = localStorage.getItem(USER_KEY);
    if (rawUser) {
        currentUser = JSON.parse(rawUser);
    }
    currentAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    currentRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
} catch (e) {
    console.error('Lỗi khi đọc auth state từ localStorage:', e);
}

// Subscribers list for reactive updates
const listeners = new Set();

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

export const authStore = {
    getUser() {
        return currentUser;
    },

    getAccessToken() {
        return currentAccessToken;
    },

    getRefreshToken() {
        return currentRefreshToken;
    },

    isAuthenticated() {
        return Boolean(currentUser && currentAccessToken);
    },

    setAuth(user, tokens) {
        currentUser = user;
        currentAccessToken = tokens?.access || null;
        currentRefreshToken = tokens?.refresh || null;

        try {
            if (user) {
                localStorage.setItem(USER_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(USER_KEY);
            }

            if (tokens?.access) {
                localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
            } else {
                localStorage.removeItem(ACCESS_TOKEN_KEY);
            }

            if (tokens?.refresh) {
                localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
            } else {
                localStorage.removeItem(REFRESH_TOKEN_KEY);
            }
        } catch (e) {
            console.error('Lỗi khi lưu auth state vào localStorage:', e);
        }

        emitChange();
    },

    updateUser(userData) {
        if (!currentUser) return;
        currentUser = { ...currentUser, ...userData };
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        } catch (e) {
            console.error('Lỗi khi cập nhật user vào localStorage:', e);
        }
        emitChange();
    },

    clearAuth() {
        currentUser = null;
        currentAccessToken = null;
        currentRefreshToken = null;

        try {
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
        } catch (e) {
            console.error('Lỗi khi xóa auth state khỏi localStorage:', e);
        }

        emitChange();
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    getSnapshot() {
        return currentUser;
    }
};

/**
 * Custom hook React phản ứng tức thì khi đăng nhập / đăng xuất
 */
export function useAuth() {
    const user = useSyncExternalStore(
        authStore.subscribe,
        authStore.getSnapshot,
        authStore.getSnapshot
    );

    return {
        user,
        isAuthenticated: Boolean(user && authStore.getAccessToken()),
        accessToken: authStore.getAccessToken(),
        login: (user, tokens) => authStore.setAuth(user, tokens),
        logout: () => authStore.clearAuth(),
        updateUser: (userData) => authStore.updateUser(userData)
    };
}

export default authStore;