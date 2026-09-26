import api from './api';
import { authStore } from '../store/authStore';

export const authService = {
    /**
     * Đăng nhập người dùng bằng Email/Số điện thoại và Mật khẩu
     */
    async login(identifier, password) {
        try {
            const response = await api.post('/auth/login/', {
                identifier,
                password,
            });

            if (response.data.success) {
                const { user, tokens } = response.data;
                authStore.setAuth(user, tokens);
                return { success: true, data: response.data };
            }

            return {
                success: false,
                message: response.data.message || 'Đăng nhập không thành công',
            };
        } catch (error) {
            const message =
                error.response?.data?.message ||
                error.response?.data?.detail ||
                'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.';
            return { success: false, message, errors: error.response?.data?.errors };
        }
    },

    /**
     * Đăng ký tài khoản khách hàng mới
     */
    async register({ fullName, phone, email, password }) {
        try {
            const response = await api.post('/auth/register/', {
                fullName,
                phone,
                email,
                password,
            });

            if (response.data.success) {
                const { user, tokens } = response.data;
                authStore.setAuth(user, tokens);
                return { success: true, data: response.data };
            }

            return {
                success: false,
                message: response.data.message || 'Đăng ký không thành công',
            };
        } catch (error) {
            const message =
                error.response?.data?.message ||
                error.response?.data?.detail ||
                'Đã xảy ra lỗi khi đăng ký. Vui lòng kiểm tra lại thông tin.';
            return { success: false, message, errors: error.response?.data?.errors };
        }
    },

    /**
     * Lấy thông tin tài khoản hiện tại từ máy chủ
     */
    async getProfile() {
        try {
            const response = await api.get('/auth/me/');
            if (response.data.success && response.data.user) {
                authStore.updateUser(response.data.user);
                return { success: true, user: response.data.user };
            }
            return { success: false };
        } catch (error) {
            return { success: false, error };
        }
    },

    /**
     * Đăng xuất tài khoản
     */
    async logout() {
        try {
            const refresh = authStore.getRefreshToken();
            if (refresh) {
                await api.post('/auth/logout/', { refresh });
            }
        } catch (e) {
            console.error('Logout error on server:', e);
        } finally {
            authStore.clearAuth();
        }
    },

    /**
     * Đổi mật khẩu tài khoản
     */
    async changePassword({ old_password, new_password, confirm_password }) {
        try {
            const response = await api.post('/auth/change-password/', {
                old_password,
                new_password,
                confirm_password,
            });

            if (response.data.success) {
                if (response.data.tokens) {
                    authStore.setAuth(authStore.getUser(), response.data.tokens);
                }
                return { success: true, message: response.data.message };
            }

            return {
                success: false,
                message: response.data.message || 'Đổi mật khẩu thất bại.',
            };
        } catch (error) {
            const message =
                error.response?.data?.message ||
                error.response?.data?.old_password?.[0] ||
                error.response?.data?.new_password?.[0] ||
                error.response?.data?.confirm_password?.[0] ||
                'Đã xảy ra lỗi khi đổi mật khẩu. Vui lòng thử lại.';
            return { success: false, message, errors: error.response?.data?.errors };
        }
    },
};

export default authService;