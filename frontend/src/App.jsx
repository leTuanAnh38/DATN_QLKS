import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/admin/AdminDashboard';
import Home from './pages/client/Home';
import Rooms from './pages/client/Rooms';
import DetailRoom from './pages/client/DetailRoom';
import Checkout from './pages/client/Checkout';
import DiningAndBar from './pages/client/DiningAndBar';
import SpaAndWellness from './pages/client/SpaAndWellness';
import Promotions from './pages/client/Promotions';
import Contact from './pages/client/Contact';
import Profile from './pages/client/Profile';
import BookingHistory from './pages/client/BookingHistory';
import Login from './pages/auth/login';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
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

        {/* Trang Lịch sử đặt phòng khách hàng */}
        <Route path="/booking-history" element={<BookingHistory />} />
        <Route path="/bookings" element={<BookingHistory />} />
        <Route path="/my-bookings" element={<BookingHistory />} />

        {/* Trang Ẩm thực & Bar */}
        <Route path="/dining" element={<DiningAndBar />} />

        {/* Trang Dịch vụ Spa */}
        <Route path="/spa" element={<SpaAndWellness />} />

        {/* Trang Ưu đãi đặc quyền */}
        <Route path="/promotions" element={<Promotions />} />

        {/* Trang Liên hệ */}
        <Route path="/contact" element={<Contact />} />

        {/* Trang Hồ sơ người dùng */}
        <Route path="/profile" element={<Profile />} />

        {/* Trang Đăng nhập / Hội viên VIP */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;