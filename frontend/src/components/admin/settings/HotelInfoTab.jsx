import React from 'react';
import {
    Building2,
    Building,
    Sparkles,
    Star,
    FileText,
    Phone,
    Mail,
    Globe,
    Palette,
    Image as ImageIcon,
    Trash2,
    RefreshCw,
    Upload,
    Edit3,
    Save,
    X,
    ShieldCheck
} from 'lucide-react';
import { formatDateTime } from '../../../utils/formatters';
import { resolveMediaUrl } from '../../../utils/mediaUrl';

export default function HotelInfoTab({
    hotelData,
    setHotelData,
    isEditingHotel,
    isSavingHotel,
    isLoading,
    hotelLastUpdated,
    canUpdateSettings,
    uploadingField,
    onStartEdit,
    onCancelEdit,
    onSubmit,
    onUploadImage,
}) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>Hồ Sơ Thương Hiệu Khách Sạn</span>
                            {isEditingHotel ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                    Đang chỉnh sửa
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    Chế độ xem
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Thông tin chính thức hiển thị trên Hóa đơn in ấn, Chân trang (Footer) và Email xác nhận
                        </p>
                    </div>
                </div>

                {hotelLastUpdated && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cập nhật gần nhất: <strong className="text-slate-700">{formatDateTime(hotelLastUpdated)}</strong></span>
                    </div>
                )}
            </div>

            <div className="p-6 sm:p-8">
                {isLoading ? (
                    <div className="py-16 text-center text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình khách sạn...</p>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* CỘT TRÁI: FORM THÔNG TIN (7 CỘT) */}
                        <div className="lg:col-span-7 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* TÊN KHÁCH SẠN */}
                                <div className="sm:col-span-2 space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Tên Khách Sạn / Khu Nghỉ Dưỡng</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hotelData.hotel_name || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, hotel_name: e.target.value })}
                                        disabled={!isEditingHotel}
                                        required
                                        className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed select-none'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* KHẨU HIỆU / SLOGAN */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Khẩu Hiệu / Slogan</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hotelData.hotel_slogan || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, hotel_slogan: e.target.value })}
                                        disabled={!isEditingHotel}
                                        placeholder="VD: 5-Star Luxury Resort & Hotel"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* XẾP HẠNG SAO */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Star className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Tiêu Chuẩn Xếp Hạng</span>
                                    </label>
                                    <select
                                        value={hotelData.stars || 5}
                                        onChange={(e) => setHotelData({ ...hotelData, stars: Number(e.target.value) })}
                                        disabled={!isEditingHotel}
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-semibold transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    >
                                        <option value={3}>★★★ 3 Sao (Standard)</option>
                                        <option value={4}>★★★★ 4 Sao (Deluxe)</option>
                                        <option value={5}>★★★★★ 5 Sao (Luxury Flagship)</option>
                                    </select>
                                </div>

                                {/* MÃ SỐ THUẾ (MST) */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Mã Số Thuế (MST Khách sạn)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hotelData.tax_code || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, tax_code: e.target.value })}
                                        disabled={!isEditingHotel}
                                        placeholder="VD: 0401234567"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono font-bold transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* HOTLINE LỄ TÂN */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Hotline Tổng Đài Lễ Tân</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hotelData.hotline || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, hotline: e.target.value })}
                                        disabled={!isEditingHotel}
                                        placeholder="VD: 1900 8899"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-semibold transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* EMAIL LIÊN HỆ */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Email CSKH / Đặt Phòng</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={hotelData.email || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, email: e.target.value })}
                                        disabled={!isEditingHotel}
                                        placeholder="VD: contact@tahotel.vn"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* WEBSITE */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Website Chính Thức</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hotelData.website || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, website: e.target.value })}
                                        disabled={!isEditingHotel}
                                        placeholder="VD: https://tahotel.vn"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* ĐỊA CHỈ TRỤ SỞ */}
                                <div className="sm:col-span-2 space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Địa Chỉ Trụ Sở Khách Sạn</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hotelData.address || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, address: e.target.value })}
                                        disabled={!isEditingHotel}
                                        placeholder="VD: 08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Ngũ Hành Sơn, Đà Nẵng"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* MÔ TẢ GIỚI THIỆU */}
                                <div className="sm:col-span-2 space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-800">
                                        Giới Thiệu Tổng Quan Thương Hiệu (Hiển thị Footer)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={hotelData.description || ''}
                                        onChange={(e) => setHotelData({ ...hotelData, description: e.target.value })}
                                        disabled={!isEditingHotel}
                                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-normal leading-relaxed transition shadow-xs ${
                                            !isEditingHotel
                                                ? 'bg-slate-100/70 text-slate-700 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-900 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* BỘ NHẬN DIỆN THƯƠNG HIỆU: LOGO & FAVICON */}
                                <div className="sm:col-span-2 pt-5 border-t border-slate-200 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Palette className="w-4 h-4 text-indigo-600" />
                                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                                Bộ Nhận Diện Thương Hiệu (Logo & Favicon)
                                            </h3>
                                        </div>
                                        <span className="text-[10px] text-slate-500 italic">
                                            Tự động hiển thị trên Thanh điều hướng, Chân trang, Tab trình duyệt & Hóa đơn in ấn
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* 1. LOGO KHÁCH SẠN */}
                                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                                                    <span>Logo Khách Sạn</span>
                                                </label>
                                                {hotelData.logo_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setHotelData({ ...hotelData, logo_url: '' })}
                                                        disabled={!isEditingHotel}
                                                        className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                                        title="Xóa logo hiện tại để dùng lại Monogram mặc định"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        <span>Xóa logo</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Khung xem trước Logo */}
                                            <div className="h-24 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center p-3 relative overflow-hidden shadow-2xs">
                                                {hotelData.logo_url ? (
                                                    <img
                                                        src={resolveMediaUrl(hotelData.logo_url)}
                                                        alt="Logo Khách Sạn"
                                                        className="max-h-full max-w-full object-contain"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400 text-[11px] text-center">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-serif font-black text-xs flex items-center justify-center mb-1">
                                                            TA
                                                        </div>
                                                        <span>Chưa tải logo (đang dùng badge TA mặc định)</span>
                                                    </div>
                                                )}
                                                {uploadingField === 'logo_url' && (
                                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-semibold text-blue-600">
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        <span>Đang tải logo lên máy chủ...</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Thao tác Upload & Nhập URL */}
                                            <div className="space-y-2">
                                                <label className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white hover:bg-blue-50 text-blue-600 border-blue-200 cursor-pointer active:scale-95'
                                                }`}>
                                                    <Upload className="w-3.5 h-3.5" />
                                                    <span>Tải ảnh logo từ máy tính</span>
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                        disabled={!isEditingHotel || uploadingField === 'logo_url'}
                                                        onChange={(e) => {
                                                            if (e.target.files?.[0]) {
                                                                onUploadImage(e.target.files[0], 'logo_url');
                                                            }
                                                        }}
                                                        className="hidden"
                                                    />
                                                </label>
                                                <input
                                                    type="text"
                                                    value={hotelData.logo_url || ''}
                                                    onChange={(e) => setHotelData({ ...hotelData, logo_url: e.target.value })}
                                                    disabled={!isEditingHotel}
                                                    placeholder="Hoặc dán trực tiếp URL ảnh logo..."
                                                    className={`w-full px-3 py-1.5 rounded-lg border text-[11px] font-mono transition ${
                                                        !isEditingHotel
                                                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                                            : 'bg-white text-slate-800 border-slate-200 focus:outline-hidden focus:border-blue-500'
                                                    }`}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 italic">
                                                Khuyến nghị: Ảnh PNG nền trong suốt hoặc SVG ngang, chiều cao tối thiểu 80px.
                                            </p>
                                        </div>

                                        {/* 2. FAVICON TRÌNH DUYỆT */}
                                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                                                    <span>Favicon Trình Duyệt</span>
                                                </label>
                                                {hotelData.favicon_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setHotelData({ ...hotelData, favicon_url: '' })}
                                                        disabled={!isEditingHotel}
                                                        className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                                        title="Xóa favicon"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        <span>Xóa icon</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Khung mô phỏng Tab Trình Duyệt Thực Tế */}
                                            <div className="h-24 rounded-xl border border-slate-200 bg-slate-200/60 p-2 flex items-center justify-center relative overflow-hidden">
                                                <div className="bg-white rounded-t-xl px-3.5 py-2 shadow-xs border border-slate-300 flex items-center gap-2 max-w-[220px]">
                                                    {hotelData.favicon_url ? (
                                                        <img
                                                            src={resolveMediaUrl(hotelData.favicon_url)}
                                                            alt="Favicon"
                                                            className="w-4 h-4 object-contain shrink-0"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
                                                            TA
                                                        </div>
                                                    )}
                                                    <span className="text-[11px] font-semibold text-slate-800 truncate">
                                                        {hotelData.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                                                    </span>
                                                    <X className="w-2.5 h-2.5 text-slate-400 shrink-0 ml-1" />
                                                </div>
                                                {uploadingField === 'favicon_url' && (
                                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600">
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        <span>Đang tải favicon...</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Thao tác Upload & Nhập URL */}
                                            <div className="space-y-2">
                                                <label className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs ${
                                                    !isEditingHotel
                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-200 cursor-pointer active:scale-95'
                                                }`}>
                                                    <Upload className="w-3.5 h-3.5" />
                                                    <span>Tải favicon từ máy tính</span>
                                                    <input
                                                        type="file"
                                                        accept="image/x-icon,image/png,image/svg+xml"
                                                        disabled={!isEditingHotel || uploadingField === 'favicon_url'}
                                                        onChange={(e) => {
                                                            if (e.target.files?.[0]) {
                                                                onUploadImage(e.target.files[0], 'favicon_url');
                                                            }
                                                        }}
                                                        className="hidden"
                                                    />
                                                </label>
                                                <input
                                                    type="text"
                                                    value={hotelData.favicon_url || ''}
                                                    onChange={(e) => setHotelData({ ...hotelData, favicon_url: e.target.value })}
                                                    disabled={!isEditingHotel}
                                                    placeholder="Hoặc dán trực tiếp URL favicon (.ico, .png)..."
                                                    className={`w-full px-3 py-1.5 rounded-lg border text-[11px] font-mono transition ${
                                                        !isEditingHotel
                                                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                                            : 'bg-white text-slate-800 border-slate-200 focus:outline-hidden focus:border-indigo-500'
                                                    }`}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 italic">
                                                Khuyến nghị: Định dạng .ico hoặc .png kích thước vuông 32x32 hoặc 64x64 pixel.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* NÚT THAO TÁC */}
                            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                {!isEditingHotel ? (
                                    canUpdateSettings ? (
                                        <button
                                            type="button"
                                            onClick={onStartEdit}
                                            disabled={isLoading}
                                            className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                            <span>Cập nhật thông tin & Logo</span>
                                        </button>
                                    ) : (
                                        <div className="text-xs text-slate-500">Chế độ xem (Chỉ Admin/Owner có quyền sửa)</div>
                                    )
                                ) : (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="submit"
                                            disabled={isSavingHotel}
                                            className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            {isSavingHotel ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    <span>Đang lưu...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    <span>Lưu thông tin & Logo</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onCancelEdit}
                                            disabled={isSavingHotel}
                                            className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer flex items-center gap-1.5"
                                        >
                                            <X className="w-4 h-4 text-slate-400" />
                                            <span>Hủy</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CỘT PHẢI: LIVE PREVIEW THẺ THƯƠNG HIỆU & MẪU IN HÓA ĐƠN (5 CỘT) */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                                <div className="flex items-center justify-between mb-4">
                                    {hotelData.logo_url ? (
                                        <img
                                            src={resolveMediaUrl(hotelData.logo_url)}
                                            alt="Logo"
                                            className="h-11 max-w-[150px] object-contain rounded-xl bg-white/10 p-1.5 border border-white/20 shadow-sm"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-serif font-black text-lg shadow-lg">
                                            TA
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 text-amber-400">
                                        {Array.from({ length: hotelData.stars || 5 }).map((_, i) => (
                                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                                        ))}
                                    </div>
                                </div>

                                <h3 className="font-serif font-bold text-lg text-white tracking-wide uppercase">
                                    {hotelData.hotel_name || 'Khách Sạn TA'}
                                </h3>
                                <p className="text-[11px] text-blue-200/80 font-medium tracking-wider uppercase mt-0.5">
                                    {hotelData.hotel_slogan || 'Luxury Resort & Hotel'}
                                </p>

                                <div className="mt-5 space-y-2 text-xs text-slate-300 border-t border-white/10 pt-4">
                                    <p className="flex items-start gap-2">
                                        <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{hotelData.address}</span>
                                    </p>
                                    <div className="flex items-center justify-between text-[11px] pt-1">
                                        <span className="flex items-center gap-1 text-slate-300">
                                            <Phone className="w-3 h-3 text-emerald-400" />
                                            {hotelData.hotline}
                                        </span>
                                        <span className="flex items-center gap-1 text-slate-300">
                                            <FileText className="w-3 h-3 text-blue-400" />
                                            MST: {hotelData.tax_code}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* MÔ PHỎNG HEADER HÓA ĐƠN IN ẤN THỰC TẾ */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
                                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-3">
                                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Xem trước đầu trang Hóa đơn in ấn:</span>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-dashed border-slate-300 text-slate-900 shadow-2xs space-y-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {hotelData.logo_url ? (
                                            <img src={resolveMediaUrl(hotelData.logo_url)} alt="Logo" className="h-7 w-auto object-contain rounded" />
                                        ) : (
                                            <div className="w-6 h-6 rounded bg-slate-900 text-white font-serif font-bold text-[10px] flex items-center justify-center">
                                                TA
                                            </div>
                                        )}
                                        <p className="font-serif font-black uppercase text-xs tracking-wide">
                                            {hotelData.hotel_name}
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                                        {hotelData.hotel_slogan}
                                    </p>
                                    <p className="text-[10px] text-slate-600 leading-snug">
                                        Đ/C: {hotelData.address}
                                    </p>
                                    <p className="text-[10px] text-slate-600 font-mono">
                                        Hotline: {hotelData.hotline} | Email: {hotelData.email} | MST: {hotelData.tax_code}
                                    </p>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic">
                                    * Mọi thay đổi tại tab này sẽ tự động cập nhật ngay trên mẫu in Hóa đơn A4 của khách.
                                </p>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

