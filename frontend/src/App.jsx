import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Home from './pages/client/Home';
import { hotelSettingStore } from './store/hotelSettingStore';

// Lazy-load các trang để tách bundle: chỉ tải code của trang khi người dùng truy cập
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Rooms = lazy(() => import('./pages/client/Rooms'));
const DetailRoom = lazy(() => import('./pages/client/DetailRoom'));
const Checkout = lazy(() => import('./pages/client/Checkout'));
const Promotions = lazy(() => import('./pages/client/Promotions'));
const Contact = lazy(() => import('./pages/client/Contact'));
const Profile = lazy(() => import('./pages/client/Profile'));
const BookingHistory = lazy(() => import('./pages/client/BookingHistory'));
const ServicesMenu = lazy(() => import('./pages/client/ServicesMenu'));
const NewsList = lazy(() => import('./pages/client/NewsList'));
const NewsDetail = lazy(() => import('./pages/client/NewsDetail'));
const CorporateBooking = lazy(() => import('./pages/client/CorporateBooking'));
const Login = lazy(() => import('./pages/auth/login'));
const AIChatbotWidget = lazy(() => import('./components/client/AIChatbotWidget'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Đang tải...</span>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function CustomerChatbot() {
  const { pathname } = useLocation();
  // Ẩn Trợ lý AI trên các trang quản trị backend /admin
  if (pathname.startsWith('/admin')) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <AIChatbotWidget />
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    // Tự động tải thông tin thương hiệu, logo & đồng bộ favicon toàn trang
    hotelSettingStore.fetchSettings();
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <CustomerChatbot />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Trang chủ */}
        <Route path="/" element={<Home />} />

        {/* Trang Danh sách phòng */}
        <Route path="/rooms" element={<Rooms />} />

        {/* Trang Chi tiết phòng */}
        <Route path="/rooms/:id" element={<DetailRoom />} />
        <Route path="/room/:id" element={<DetailRoom />} />
        <Route path="/rooms/detail" element={<DetailRoom />} />

        {/* Trang Đặt phòng (Checkout / Booking) */}
        <Route path="/checkout/:id" element={<Checkout />} />
        <Route path="/booking/:id" element={<Checkout />} />
        <Route path="/checkout" element={<Checkout />} />

        {/* Trang Đặt phòng Khách đoàn & Doanh nghiệp B2B */}
        <Route path="/corporate-booking" element={<CorporateBooking />} />
        <Route path="/group-booking" element={<CorporateBooking />} />

        {/* Trang Lịch sử đặt phòng khách hàng */}
        <Route path="/booking-history" element={<BookingHistory />} />
        <Route path="/bookings" element={<BookingHistory />} />
        <Route path="/my-bookings" element={<BookingHistory />} />

        {/* Chuyển hướng các trang cũ về Menu Dịch vụ */}
        <Route path="/dining" element={<Navigate to="/services" replace />} />
        <Route path="/spa" element={<Navigate to="/services" replace />} />

        {/* Trang Menu Dịch vụ Tại Phòng */}
        <Route path="/services" element={<ServicesMenu />} />
        <Route path="/menu" element={<ServicesMenu />} />

        {/* Trang Ưu đãi đặc quyền */}
        <Route path="/promotions" element={<Promotions />} />

        {/* Trang Tin tức & Cẩm nang */}
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/:slug" element={<NewsDetail />} />
        <Route path="/blog" element={<Navigate to="/news" replace />} />
        <Route path="/blog/:slug" element={<Navigate to="/news" replace />} />

        {/* Trang Liên hệ */}
        <Route path="/contact" element={<Contact />} />

        {/* Trang Hồ sơ người dùng */}
        <Route path="/profile" element={<Profile />} />

        {/* Trang Đăng nhập / Hội viên VIP */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/profile" element={<AdminDashboard initialTab="profile" />} />
        <Route path="/admin/customers/:id" element={<AdminDashboard initialTab="customer-detail" />} />
        <Route path="/admin/analytics" element={<AdminDashboard initialTab="analytics" />} />
        <Route path="/admin/reports" element={<AdminDashboard initialTab="analytics" />} />
        <Route path="/admin/settings" element={<AdminDashboard initialTab="settings" />} />
        <Route path="/admin/amenities" element={<AdminDashboard initialTab="amenities" />} />
        <Route path="/admin/posts" element={<AdminDashboard initialTab="posts" />} />
        <Route path="/admin/promotions" element={<AdminDashboard initialTab="promotions" />} />
        <Route path="/admin/lost-and-found" element={<AdminDashboard initialTab="lost-and-found" />} />
        <Route path="/admin/minibar" element={<AdminDashboard initialTab="minibar" />} />
        <Route path="/admin/minibar-items" element={<AdminDashboard initialTab="minibar" />} />
        <Route path="/admin/audit-logs" element={<AdminDashboard initialTab="audit-logs" />} />
        <Route path="/admin/system-logs" element={<AdminDashboard initialTab="audit-logs" />} />
        <Route path="/admin/bookings" element={<AdminDashboard initialTab="bookings" />} />
        <Route path="/admin/services" element={<AdminDashboard initialTab="services" />} />
        <Route path="/admin/rooms" element={<AdminDashboard initialTab="rooms" />} />
        <Route path="/admin/finance" element={<AdminDashboard initialTab="invoices" />} />
        <Route path="/admin/invoices" element={<AdminDashboard initialTab="invoices" />} />
        <Route path="/admin/groups" element={<AdminDashboard initialTab="bookings" />} />
      </Routes>
      </Suspense>

    </BrowserRouter>
  );
}

export default App;