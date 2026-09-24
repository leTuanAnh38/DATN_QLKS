import React, { useState } from 'react';

export default function HotelAdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [timeFilter, setTimeFilter] = useState('month');
    const [bookingFilter, setBookingFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Danh sách đặt phòng mới nhất
    const [bookings, setBookings] = useState([
        {
            id: '#BK-9281',
            guest: { name: 'Trần Hoàng Cường', email: 'cuong.tran@gmail.com', avatarText: 'TC', isVip: true },
            room: { name: 'Executive Club Seafront Suite', detail: '3 Đêm • 2 Khách lớn' },
            schedule: { dates: '25/09 - 28/09/2026', note: 'Nhận: 14:00 (VIP check-in)' },
            payment: { amount: '28.500.000 ₫', status: 'Đã thanh toán (Visa)' },
            status: 'confirmed'
        },
        {
            id: '#BK-9280',
            guest: { name: 'Emma Watson', email: '+44 7911 123456', avatarText: 'EW', isVip: false },
            room: { name: 'Deluxe Ocean King', detail: '2 Đêm • 1 Khách' },
            schedule: { dates: '26/09 - 28/09/2026', note: 'Nhận: 15:00 dự kiến' },
            payment: { amount: '9.600.000 ₫', status: 'Chờ thanh toán tại Cổng' },
            status: 'pending'
        },
        {
            id: '#BK-9279',
            guest: { name: 'Nguyễn Lan Hương', email: 'lanhuong.danang@gmail.com', avatarText: 'NL', isVip: true },
            room: { name: 'Beachfront Villa', detail: '4 Đêm • 4 Khách lớn' },
            schedule: { dates: '27/09 - 01/10/2026', note: 'Nhận: 14:00' },
            payment: { amount: '64.000.000 ₫', status: 'Thanh toán trực tuyến 100%' },
            status: 'confirmed'
        },
        {
            id: '#BK-9278',
            guest: { name: 'Takashi Kato', email: 'kato.tokyo@resort.jp', avatarText: 'TK', isVip: false },
            room: { name: 'Ocean Penthouse', detail: '2 Đêm • 2 Khách' },
            schedule: { dates: '25/09 - 27/09/2026', note: 'Hủy ngày 23/09' },
            payment: { amount: '32.000.000 ₫', status: 'Hoàn tiền thẻ thành công' },
            status: 'cancelled'
        },
        {
            id: '#BK-9277',
            guest: { name: 'Lê Minh Tuấn', email: '0905 128 999', avatarText: 'LM', isVip: false },
            room: { name: 'Deluxe Ocean King', detail: '1 Đêm • 2 Khách' },
            schedule: { dates: '25/09 - 26/09/2026', note: 'Nhận phòng sớm 12:00' },
            payment: { amount: '4.800.000 ₫', status: 'Đã thanh toán (Trực tuyến)' },
            status: 'checked_in'
        },
        {
            id: '#BK-9276',
            guest: { name: 'David Smith', email: 'd.smith@auscorp.au', avatarText: 'DS', isVip: false },
            room: { name: 'Executive Club Suite', detail: '5 Đêm • 1 Khách' },
            schedule: { dates: '28/09 - 03/10/2026', note: 'Nhận: 14:00' },
            payment: { amount: '47.500.000 ₫', status: 'Cọc 50% qua Booking.com' },
            status: 'pending'
        }
    ]);

    // Bộ lọc đặt phòng
    const filteredBookings = bookings.filter((item) => {
        const matchFilter =
            bookingFilter === 'all'
                ? true
                : bookingFilter === 'pending'
                    ? item.status === 'pending'
                    : item.status === 'checked_in';
        const matchSearch =
            item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.room.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchFilter && matchSearch;
    });

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* ========================================================================= */}
            {/* 1. SIDEBAR CỐ ĐỊNH BÊN TRÁI */}
            {/* ========================================================================= */}
            <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-40 border-r border-slate-800">
                <div>
                    {/* Logo Brand Header */}
                    <div className="h-20 flex items-center px-6 border-b border-slate-800/80 gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-serif font-black text-xl shadow-lg shadow-blue-600/40">
                            TA
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-base tracking-wide font-serif"> TA ĐÀ NẴNG </span>
                            <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold"> Luxury Hotel Admin </span>
                        </div>
                    </div>

                    {/* Nav Links */}
                    <div className="px-4 py-6">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-3 block"> Quản trị hệ thống </span>
                        <nav className="space-y-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${activeTab === 'overview'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                <span>Tổng quan</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('rooms')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'rooms' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                <span>Quản lý Phòng</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('bookings')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'bookings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span>Quản lý Đặt phòng</span>
                                </div>
                                <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"> 14 </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('services')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'services' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <span>Quản lý Dịch vụ</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('guests')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'guests' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <span>Quản lý Khách hàng</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('finance')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'finance' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                                </svg>
                                <span>Thanh toán & Hóa đơn</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('settings')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Cài đặt hệ thống</span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Sidebar Footer Widget */}
                <div className="p-4 border-t border-slate-800/80">
                    <div className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-orange-400">⚙️</span>
                            <div>
                                <strong className="text-white block font-semibold">Portal v2.4</strong>
                                <span className="text-[10px] text-slate-400">Đà Nẵng Luxury</span>
                            </div>
                        </div>
                        <button className="text-slate-400 hover:text-white" title="Đăng xuất">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ========================================================================= */}
            {/* 2. KHU VỰC NỘI DUNG CHÍNH (BÊN PHẢI ml-64) */}
            {/* ========================================================================= */}
            <div className="flex-1 ml-64 flex flex-col min-h-screen">
                {/* Top Navbar */}
                <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
                    {/* Search bar */}
                    <div className="relative w-96">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm phòng, khách hàng, mã đặt chỗ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                        />
                    </div>

                    {/* Right Status + Notifications + Avatar */}
                    <div className="flex items-center space-x-6">
                        <div className="hidden lg:flex flex-col text-right">
                            <span className="text-xs font-bold text-slate-900"> Thứ Hai, 24 Tháng 10, 2024 </span>
                            <span className="text-[11px] text-emerald-600 font-medium flex items-center justify-end gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Hệ thống máy chủ ổn định
                            </span>
                        </div>

                        {/* Chuông thông báo */}
                        <div className="relative cursor-pointer">
                            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                                5
                            </span>
                        </div>

                        {/* Profile Avatar */}
                        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                            <div className="flex flex-col text-right">
                                <span className="text-xs font-bold text-slate-900 leading-tight"> Quản Trị Viên VIP </span>
                                <span className="text-[10px] text-blue-600 font-semibold">General Manager</span>
                            </div>
                            <div className="w-9 h-9 rounded-full border border-blue-600 p-0.5 overflow-hidden">
                                <img
                                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                                    alt="Admin Avatar"
                                    className="w-full h-full object-cover rounded-full"
                                />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Nội dung bảng điều khiển */}
                <main className="p-8 space-y-6 flex-1">
                    {/* Welcome & Time Filters Banner */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                                    {' '}
                                    LIVE PMS 5-STAR PORTAL{' '}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-500">Đồng bộ PMS thời gian thực</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"> Xin chào, Quản trị viên Hoàng Nam 👋 </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {' '}
                                Bảng điều khiển vận hành khách sạn & giám sát công suất phòng thực tế tại Khách Sạn TA Đà Nẵng.{' '}
                            </p>
                        </div>

                        {/* Filter buttons & CTA */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
                                <button
                                    type="button"
                                    onClick={() => setTimeFilter('today')}
                                    className={`px-3 py-1.5 rounded-lg transition ${timeFilter === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                                        }`}
                                >
                                    Hôm nay
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimeFilter('7days')}
                                    className={`px-3 py-1.5 rounded-lg transition ${timeFilter === '7days' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                                        }`}
                                >
                                    7 ngày qua
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimeFilter('month')}
                                    className={`px-3 py-1.5 rounded-lg transition ${timeFilter === 'month' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                                        }`}
                                >
                                    Tháng này (9/2026)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimeFilter('year')}
                                    className={`px-3 py-1.5 rounded-lg transition ${timeFilter === 'year' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                                        }`}
                                >
                                    Năm 2026
                                </button>
                            </div>
                            <button
                                type="button"
                                className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
                            >
                                <span>📥</span>
                                <span>Xuất Báo Cáo</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => alert('Mở bảng tạo đơn đặt phòng mới')}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/25 transition flex items-center gap-1.5"
                            >
                                <span>＋</span>
                                <span>Tạo Đặt Phòng Mới</span>
                            </button>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* 4 THẺ THỐNG KÊ NHANH (STAT CARDS) */}
                    {/* ========================================================================= */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* 1. Doanh thu */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> DOANH THU THÁNG 09 </span>
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs"> $ </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                    {' '}
                                    3.845.000.000 <span className="text-xs font-normal text-slate-500">VND</span>{' '}
                                </div>
                                <div className="flex items-center text-xs text-emerald-600 font-bold gap-1">
                                    <span>↗ +18.4%</span>
                                    <span className="text-[11px] text-slate-400 font-normal">so với tháng trước</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span>Mục tiêu Q3: 4.2 tỷ</span>
                                <span className="font-semibold text-blue-600">Đạt 91.5%</span>
                            </div>
                        </div>

                        {/* 2. Công suất phòng */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> CÔNG SUẤT PHÒNG </span>
                                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xs"> 🏠 </div>
                                </div>
                                <div className="flex items-baseline justify-between mb-1.5">
                                    <span className="text-xl sm:text-2xl font-bold text-slate-900">
                                        {' '}
                                        88<span className="text-sm font-normal text-slate-400">/112</span>{' '}
                                    </span>
                                    <span className="text-xs text-slate-500">Phòng có khách</span>
                                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"> 78.5% </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: '78.5%' }}></div>
                                </div>
                            </div>
                            <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span>Sẵn sàng đón khách</span>
                                <strong className="text-slate-800">24 Phòng trống</strong>
                            </div>
                        </div>

                        {/* 3. Chờ xác nhận */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> CHỜ XÁC NHẬN </span>
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs"> 🕒 </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                    {' '}
                                    14 <span className="text-xs font-normal text-slate-500">Đơn đặt mới</span>{' '}
                                </div>
                                <div className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                    <span>⚠️ Cần phản hồi &lt; 15 phút</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span>Kênh OTA trực tiếp</span>
                                <strong className="text-slate-800">9 Đơn OTA</strong>
                            </div>
                        </div>

                        {/* 4. Yêu cầu dịch vụ */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> YÊU CẦU DỊCH VỤ </span>
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs"> 🔔 </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                    {' '}
                                    28 <span className="text-xs font-normal text-slate-500">Yêu cầu nóng</span>{' '}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-3">
                                    <span>
                                        Spa: <strong className="text-slate-800">12</strong>
                                    </span>
                                    <span>
                                        F&B: <strong className="text-slate-800">10</strong>
                                    </span>
                                    <span>
                                        Shuttle: <strong className="text-slate-800">6</strong>
                                    </span>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span>Trạng thái phân bổ</span>
                                <strong className="text-blue-600">8 Chưa điều phối</strong>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* CÔNG SUẤT THEO HẠNG PHÒNG & NGUỒN ĐẶT PHÒNG (DONUT CHART) */}
                    {/* ========================================================================= */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Biểu đồ thanh tiến độ công suất các hạng phòng (8 cột) */}
                        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"> GIÁM SÁT CÔNG SUẤT </span>
                                    <h3 className="font-serif text-base font-bold text-slate-900"> Tỷ lệ lấp đầy theo hạng phòng </h3>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        {' '}
                                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span> Đang ở{' '}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        {' '}
                                        <span className="w-2.5 h-2.5 rounded-sm bg-slate-200"></span> Trống{' '}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-4 text-xs">
                                {/* 1 */}
                                <div>
                                    <div className="flex justify-between font-medium text-slate-700 mb-1">
                                        <span>Deluxe Ocean King (48 phòng)</span>
                                        <span>
                                            <strong className="text-slate-900">42/48 phòng</strong> (87.5%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div className="bg-blue-600 h-3 rounded-full" style={{ width: '87.5%' }}></div>
                                    </div>
                                </div>
                                {/* 2 */}
                                <div>
                                    <div className="flex justify-between font-medium text-slate-700 mb-1">
                                        <span>Executive Club Suite (32 phòng)</span>
                                        <span>
                                            <strong className="text-slate-900">25/32 phòng</strong> (78.1%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div className="bg-blue-600 h-3 rounded-full" style={{ width: '78.1%' }}></div>
                                    </div>
                                </div>
                                {/* 3 */}
                                <div>
                                    <div className="flex justify-between font-medium text-slate-700 mb-1">
                                        <span>Beachfront Presidential Villa (16 căn)</span>
                                        <span>
                                            <strong className="text-slate-900">14/16 căn</strong> (87.5%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div className="bg-orange-500 h-3 rounded-full" style={{ width: '87.5%' }}></div>
                                    </div>
                                </div>
                                {/* 4 */}
                                <div>
                                    <div className="flex justify-between font-medium text-slate-700 mb-1">
                                        <span>Ocean Penthouse Signature (16 phòng)</span>
                                        <span>
                                            <strong className="text-slate-900">7/16 phòng</strong> (43.7%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div className="bg-blue-400 h-3 rounded-full" style={{ width: '43.7%' }}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span className="flex items-center gap-1.5">
                                    {' '}
                                    <span className="text-blue-600">ℹ️</span> Giờ dọn phòng cao điểm: 11:30 - 14:00 (Đang có 12 nhân viên dọn dẹp thường trực){' '}
                                </span>
                                <button className="text-blue-600 font-semibold hover:underline"> Xem bản đồ tầng 3D → </button>
                            </div>
                        </div>

                        {/* Donut Chart SVG Cơ cấu lưu trú (4 cột) */}
                        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"> CƠ CẤU LƯU TRÚ </span>
                                <h3 className="font-serif text-base font-bold text-slate-900 mb-4"> Nguồn Đặt Phòng </h3>
                                {/* Donut Chart SVG */}
                                <div className="relative flex items-center justify-center my-4">
                                    <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                                        {/* Background */}
                                        <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                                        {/* Website Trực Tiếp (62%) */}
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="38"
                                            fill="none"
                                            stroke="#2563eb"
                                            strokeWidth="12"
                                            strokeDasharray="238.76"
                                            strokeDashoffset="90.72"
                                            strokeLinecap="round"
                                        />
                                        {/* OTA (24%) */}
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="38"
                                            fill="none"
                                            stroke="#f97316"
                                            strokeWidth="12"
                                            strokeDasharray="238.76"
                                            strokeDashoffset="181.45"
                                            transform="rotate(223.2 50 50)"
                                        />
                                        {/* Hội viên TA (14%) */}
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="38"
                                            fill="none"
                                            stroke="#0f172a"
                                            strokeWidth="12"
                                            strokeDasharray="238.76"
                                            strokeDashoffset="205.33"
                                            transform="rotate(309.6 50 50)"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-xl font-black text-slate-900">142</span>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Lượt đặt / tuần</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-600">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Website Trực Tuyến (TA Direct)
                                    </span>
                                    <span className="font-bold text-slate-900">
                                        62% <span className="text-slate-400 font-normal">(88)</span>
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-600">
                                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> OTA (Booking.com / Agoda)
                                    </span>
                                    <span className="font-bold text-slate-900">
                                        24% <span className="text-slate-400 font-normal">(34)</span>
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-600">
                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span> Hội Viên TA Club Platinum
                                    </span>
                                    <span className="font-bold text-slate-900">
                                        14% <span className="text-slate-400 font-normal">(20)</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* BẢNG DỮ LIỆU ĐẶT PHÒNG MỚI NHẤT + CONCIERGE DỊCH VỤ NÓNG */}
                    {/* ========================================================================= */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Bảng Đặt Phòng (8 cột) */}
                        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-serif text-base font-bold text-slate-900"> Danh sách Đặt phòng mới nhất </h3>
                                    <p className="text-xs text-slate-500 mt-0.5"> Dữ liệu đặt phòng thời gian thực đồng bộ tự động </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setBookingFilter('all')}
                                            className={`px-3 py-1 rounded-lg font-semibold transition ${bookingFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                                                }`}
                                        >
                                            Tất cả
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBookingFilter('pending')}
                                            className={`px-3 py-1 rounded-lg font-semibold transition ${bookingFilter === 'pending' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600'
                                                }`}
                                        >
                                            Chờ duyệt
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBookingFilter('checked_in')}
                                            className={`px-3 py-1 rounded-lg font-semibold transition ${bookingFilter === 'checked_in' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                                                }`}
                                        >
                                            Đã check-in
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => alert('Làm mới dữ liệu từ PMS')}
                                        title="Đồng bộ lại"
                                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs"
                                    >
                                        🔄
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <th className="py-3 px-5">MÃ BOOKING</th>
                                            <th className="py-3 px-5">KHÁCH HÀNG</th>
                                            <th className="py-3 px-5">HẠNG PHÒNG & THỜI GIAN</th>
                                            <th className="py-3 px-5">LỊCH TRÌNH</th>
                                            <th className="py-3 px-5">TỔNG TIỀN & KÊNH</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredBookings.map((b) => (
                                            <tr key={b.id} className="hover:bg-blue-50/20 transition">
                                                {/* ID */}
                                                <td className="py-3.5 px-5 font-mono font-bold text-blue-600"> {b.id} </td>
                                                {/* Guest */}
                                                <td className="py-3.5 px-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                                                            {b.guest.avatarText}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-semibold text-slate-900">{b.guest.name}</span>
                                                                {b.guest.isVip && (
                                                                    <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1 rounded"> VIP </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 block">{b.guest.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Room */}
                                                <td className="py-3.5 px-5">
                                                    <strong className="text-slate-800 block font-medium">{b.room.name}</strong>
                                                    <span className="text-[10px] text-slate-400">{b.room.detail}</span>
                                                </td>
                                                {/* Schedule */}
                                                <td className="py-3.5 px-5">
                                                    <span className="font-semibold text-slate-800 block">{b.schedule.dates}</span>
                                                    <span className="text-[10px] text-slate-400">{b.schedule.note}</span>
                                                </td>
                                                {/* Total & Payment */}
                                                <td className="py-3.5 px-5">
                                                    <span className="font-bold text-slate-900 block">{b.payment.amount}</span>
                                                    <span className="text-[10px] text-blue-600">{b.payment.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Table Pagination */}
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    Hiển thị <strong>1-6</strong> trong tổng số <strong>142</strong> đơn đặt phòng
                                </span>
                                <div className="flex items-center space-x-1">
                                    <span className="text-slate-400 text-xs px-2">Trước</span>
                                    <button className="w-6 h-6 rounded bg-blue-600 text-white font-bold text-xs">1</button>
                                    <button className="w-6 h-6 rounded hover:bg-slate-100 text-slate-600 text-xs">2</button>
                                    <button className="w-6 h-6 rounded hover:bg-slate-100 text-slate-600 text-xs">3</button>
                                    <span className="text-slate-400 text-xs px-1">...</span>
                                    <button className="w-6 h-6 rounded hover:bg-slate-100 text-slate-600 text-xs">24</button>
                                    <span className="text-blue-600 text-xs px-2 cursor-pointer hover:underline">Tiếp theo</span>
                                </div>
                            </div>
                        </div>

                        {/* Concierge & Dịch Vụ Nóng (4 cột) */}
                        <div className="lg:col-span-4 space-y-6">
                            {/* Thẻ Yêu cầu nóng */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                                        <h3 className="font-serif text-base font-bold text-slate-900"> Concierge & Dịch Vụ Nóng </h3>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">HÔM NAY</span>
                                </div>
                                <div className="space-y-3.5 text-xs">
                                    {/* Task 1 */}
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                                        <span className="text-lg">🚖</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <strong className="text-slate-900 text-xs">Xe Maybach đón sân bay</strong>
                                                <span className="text-[10px] text-orange-600 font-bold">14:00</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-1">
                                                {' '}
                                                Khách VIP Robert Chen (Chuyến bay VN-128 từ Incheon). Lái xe: Nguyễn Văn An đã sẵn sàng.{' '}
                                            </p>
                                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60">
                                                <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-semibold"> VIP Concierge </span>
                                                <span className="text-[10px] text-slate-400">5 phút trước</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Task 2 */}
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                                        <span className="text-lg">🍵</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <strong className="text-slate-900 text-xs">Trà Chiều Hoàng Gia</strong>
                                                <span className="text-[10px] text-slate-400">Phòng 1802</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-1"> Yêu cầu phục vụ 02 set High-Tea kiểu Anh cùng bánh scone tươi tại ban công tầng 18. </p>
                                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60">
                                                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold"> F&B In-room </span>
                                                <span className="text-[10px] text-slate-400">18 phút trước</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Task 3 */}
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                                        <span className="text-lg">📅</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <strong className="text-slate-900 text-xs">Gia hạn thêm 2 đêm</strong>
                                                <span className="text-[10px] text-slate-400">Phòng 2201</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-1"> Gia đình ông David Kim gia hạn phòng Presidential Suite đến ngày 29/09. Đã thu phụ phí. </p>
                                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60">
                                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold"> Lễ Tân Front Desk </span>
                                                <span className="text-[10px] text-slate-400">42 phút trước</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="w-full mt-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition"
                                >
                                    Xem tất cả 28 yêu cầu đang mở →
                                </button>
                            </div>

                            {/* Gợi ý phân bổ phòng trống */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-slate-900 text-xs">Gợi ý phân bổ phòng trống</span>
                                    <span className="text-[10px] font-bold text-orange-500">HOT TIPS</span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between">
                                        <div>
                                            <strong className="text-slate-800 block text-xs">Ocean Suite #1402 (Đã khử khuẩn)</strong>
                                        </div>
                                        <span className="text-emerald-600 font-bold text-[11px]">Sẵn sàng</span>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between">
                                        <div>
                                            <strong className="text-slate-800 block text-xs">Deluxe King #0809 (Đang dọn)</strong>
                                        </div>
                                        <span className="text-amber-600 font-bold text-[11px]">Dự kiến 13:30</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}