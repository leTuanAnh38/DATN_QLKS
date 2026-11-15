import { useSyncExternalStore } from 'react';

// Keys lưu trong LocalStorage
const USER_KEY = 'ta_hotel_user';
const ACCESS_TOKEN_KEY = 'ta_hotel_access_token';
const REFRESH_TOKEN_KEY = 'ta_hotel_refresh_token';

// In-memory state cache
let currentUser = null;
let currentAccessToken = null;
let currentRefreshToken = null;
let activeStorage = typeof window !== 'undefined' ? window.localStorage : null;

const removeKeysFromStorage = (storage) => {
    if (!storage) return;
    storage.removeItem(USER_KEY);
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
};

const readFromStorage = (storage) => {
    if (!storage) return null;
    const rawUser = storage.getItem(USER_KEY);
    const accessToken = storage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
    if (!rawUser && !accessToken && !refreshToken) return null;
    return {
        user: rawUser ? JSON.parse(rawUser) : null,
        accessToken,
        refreshToken,
    };
};

try {
    const localData = typeof window !== 'undefined' ? readFromStorage(window.localStorage) : null;
    const sessionData = !localData && typeof window !== 'undefined' ? readFromStorage(window.sessionStorage) : null;

    if (localData) {
        currentUser = localData.user;
        currentAccessToken = localData.accessToken;
        currentRefreshToken = localData.refreshToken;
        activeStorage = window.localStorage;
    } else if (sessionData) {
        currentUser = sessionData.user;
        currentAccessToken = sessionData.accessToken;
        currentRefreshToken = sessionData.refreshToken;
        activeStorage = window.sessionStorage;
    }
} catch (e) {
    console.error('Lỗi khi đọc auth state từ storage:', e);
}

// Đồng bộ trạng thái đăng nhập tức thì giữa các tab trình duyệt (chỉ với localStorage)
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === USER_KEY || e.key === ACCESS_TOKEN_KEY || e.key === REFRESH_TOKEN_KEY) {
            try {
                const localData = readFromStorage(window.localStorage);
                const sessionData = !localData ? readFromStorage(window.sessionStorage) : null;
                const next = localData || sessionData;
                currentUser = next?.user || null;
                currentAccessToken = next?.accessToken || null;
                currentRefreshToken = next?.refreshToken || null;
                activeStorage = sessionData ? window.sessionStorage : window.localStorage;
            } catch (err) {
                console.error('Lỗi khi đồng bộ storage auth:', err);
            }
            emitChange();
        }
    });
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

    setAuth(user, tokens, options = {}) {
        currentUser = user;
        currentAccessToken = tokens?.access || null;
        currentRefreshToken = tokens?.refresh || null;

        if (typeof window !== 'undefined' && options.remember !== undefined) {
            activeStorage = options.remember ? window.localStorage : window.sessionStorage;
            const otherStorage = options.remember ? window.sessionStorage : window.localStorage;
            try {
                removeKeysFromStorage(otherStorage);
            } catch {
                // Ignore storage cleanup errors
            }
        }

        const targetStorage = activeStorage || (typeof window !== 'undefined' ? window.localStorage : null);

        try {
            if (targetStorage) {
                if (user) {
                    targetStorage.setItem(USER_KEY, JSON.stringify(user));
                } else {
                    targetStorage.removeItem(USER_KEY);
                }

                if (tokens?.access) {
                    targetStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
                } else {
                    targetStorage.removeItem(ACCESS_TOKEN_KEY);
                }

                if (tokens?.refresh) {
                    targetStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
                } else {
                    targetStorage.removeItem(REFRESH_TOKEN_KEY);
                }
            }
        } catch (e) {
            console.error('Lỗi khi lưu auth state vào storage:', e);
        }

        emitChange();
    },

    updateUser(userData) {
        if (!currentUser) return;
        const mergedGuestProfile = (currentUser.guest_profile || userData?.guest_profile)
            ? { ...(currentUser.guest_profile || {}), ...(userData?.guest_profile || {}) }
            : null;

        currentUser = {
            ...currentUser,
            ...userData,
            ...(mergedGuestProfile ? { guest_profile: mergedGuestProfile } : {}),
        };
        const targetStorage = activeStorage || (typeof window !== 'undefined' ? window.localStorage : null);
        try {
            targetStorage?.setItem(USER_KEY, JSON.stringify(currentUser));
        } catch (e) {
            console.error('Lỗi khi cập nhật user vào storage:', e);
        }
        emitChange();
    },

    clearAuth() {
        currentUser = null;
        currentAccessToken = null;
        currentRefreshToken = null;

        if (typeof window !== 'undefined') {
            activeStorage = window.localStorage;
            try {
                removeKeysFromStorage(window.localStorage);
                removeKeysFromStorage(window.sessionStorage);
            } catch (e) {
                console.error('Lỗi khi xóa auth state khỏi storage:', e);
            }
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

import { hasPermission } from '../utils/permission';

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
        updateUser: (userData) => authStore.updateUser(userData),
        hasPermission: (module, action = 'read') => hasPermission(user, module, action)
    };
}

export { hasPermission } from '../utils/permission';
export default authStore;