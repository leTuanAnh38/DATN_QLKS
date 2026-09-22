import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/client/Home';
import Rooms from './pages/client/Rooms';
import DetailRoom from './pages/client/DetailRoom';

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;