import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    BedDouble,
    Users,
    Award,
    RefreshCw,
    PieChart as PieIcon,
    BarChart3,
    Phone,
    Mail,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    Layers,
    ChevronDown,
    Building2,
    Crown,
    ExternalLink,
    Download,
    Printer,
    FileSpreadsheet
} from 'lucide-react';
import { reportService } from '../../services/reportService';

// Format tiền tệ VNĐ (ví dụ: 15.000.000 ₫)
const formatVND = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0 ₫';
    return `${Number(value).toLocaleString('vi-VN')} ₫`;
};

// Format số tiền rút gọn cho trục Y biểu đồ (ví dụ: 5 tr, 10 tr, 500 k)
const formatShortVND = (value) => {
    if (!value) return '0';
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)} tr`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(0)} k`;
    }
    return String(value);
};

// Bảng màu cho Biểu đồ tròn Loại phòng
const CATEGORY_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#4f46e5'];

// Custom Tooltip cho Biểu đồ Doanh thu
const CustomRevenueTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-2xl border border-slate-700/80 backdrop-blur-md text-xs min-w-[200px] animate-fadeIn">
                <div className="font-semibold text-slate-300 pb-2 mb-2 border-b border-slate-800 flex items-center justify-between">
                    <span>{data.full_date || label}</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-400/20 font-bold">
                        Doanh thu
                    </span>
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Doanh thu:</span>
                        <span className="font-bold text-emerald-400 text-sm">
                            {formatVND(data.revenue)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Lượt đặt phòng:</span>
                        <span className="font-bold text-amber-300">
                            {data.booking_count} đơn
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// Custom Tooltip cho Biểu đồ Tròn
const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const item = payload[0];
        return (
            <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
                <div className="font-bold text-white mb-1">{item.name}</div>
                <div className="text-emerald-400 font-semibold">
                    {item.payload.revenue !== undefined ? formatVND(item.payload.revenue) : `${item.value} phòng`}
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                    Tỷ trọng: <strong className="text-white">{item.payload.percentage}%</strong>
                    {item.payload.booking_count !== undefined && ` (${item.payload.booking_count} đơn)`}
                </div>
            </div>
        );
    }
    return null;
};

export default function Analytics({ onNavigateToCustomer }) {
    // State Bộ lọc thời gian: 'day' | 'week' | 'month' | 'year'
    const [timeFilter, setTimeFilter] = useState('month');
    const [chartType, setChartType] = useState('area'); // 'area' | 'bar'
    const [pieTab, setPieTab] = useState('category'); // 'category' | 'room_status'

    // Data states
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [isExportOpen, setIsExportOpen] = useState(false);

    // Fetch dữ liệu báo cáo
    const loadReportData = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setIsRefreshing(true);
        else setIsLoading(true);
        setErrorMessage(null);

        try {
            const data = await reportService.getReports({ filter: timeFilter });
            setReportData(data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Không thể lấy báo cáo:', error);
            setErrorMessage('Không thể tải dữ liệu báo cáo thống kê. Vui lòng kiểm tra kết nối máy chủ.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [timeFilter]);

    useEffect(() => {
        loadReportData(false);
    }, [loadReportData]);

    // Xử lý xuất file CSV tương thích Excel (UTF-8 BOM)
    const handleExportCSV = () => {
        if (!reportData) return;
        const sum = reportData.summary || {};
        const revChart = reportData.revenue_chart || [];
        const topR = reportData.top_rooms || [];
        const topC = reportData.top_vip_customers || [];

        let csv = '\uFEFF'; // UTF-8 BOM cho Excel
        csv += 'BÁO CÁO THỐNG KÊ DOANH THU & HOẠT ĐỘNG KHÁCH SẠN\n';
        csv += `Kỳ báo cáo:,${reportData.filter_label || timeFilter}\n`;
        csv += `Thời gian xuất:,${new Date().toLocaleString('vi-VN')}\n\n`;

        csv += '1. TỔNG QUAN CHỈ SỐ CHÍNH (KPI)\n';
        csv += `Tổng doanh thu trong kỳ:,${sum.total_revenue || 0} VND\n`;
        csv += `Tăng trưởng so với kỳ trước:,${sum.growth_rate || 0}%\n`;
        csv += `Tổng số lượt đặt phòng (Bookings):,${sum.total_bookings || 0} lượt\n`;
        csv += `Tỉ lệ lấp đầy phòng:,${sum.occupancy_rate || 0}%\n`;
        csv += `Phòng đang ở:,${sum.occupied_rooms || 0}/${sum.total_rooms || 0}\n`;
        csv += `Phòng trống sẵn sàng:,${sum.available_rooms || 0}\n`;
        csv += `Giá trị đơn trung bình (AOV):,${sum.average_order_value || 0} VND\n\n`;

        csv += '2. CHI TIẾT DOANH THU THEO MỐC THỜI GIAN\n';
        csv += 'Thời gian,Doanh thu (VND),Số lượt đặt\n';
        revChart.forEach((item) => {
            csv += `"${item.full_date || item.label}",${item.revenue || 0},${item.booking_count || 0}\n`;
        });
        csv += '\n';

        csv += '3. TOP 5 PHÒNG ĐƯỢC ĐẶT NHIỀU NHẤT\n';
        csv += 'Hạng,Số phòng,Loại phòng,Số lượt đặt,Doanh thu mang lại (VND)\n';
        topR.forEach((r, idx) => {
            csv += `${idx + 1},"${r.room_number}","${r.category_name || ''}",${r.booking_count || 0},${r.revenue || 0}\n`;
        });
        csv += '\n';

        csv += '4. TOP 5 KHÁCH HÀNG VIP CHI TIÊU CAO NHẤT\n';
        csv += 'Hạng,Tên khách hàng,Email,Hạng VIP,Số đơn đặt,Tổng chi tiêu (VND)\n';
        topC.forEach((c, idx) => {
            csv += `${idx + 1},"${c.full_name || c.username}","${c.email || ''}","${c.vip_tier || ''}",${c.booking_count || 0},${c.total_spent || 0}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Bao_cao_doanh_thu_${timeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsExportOpen(false);
    };

    const handlePrint = () => {
        setIsExportOpen(false);
        window.print();
    };

    const summary = reportData?.summary || {};
    const revenueChart = reportData?.revenue_chart || [];
    const roomStatus = reportData?.room_status || [];
    const revenueByCategory = reportData?.revenue_by_category || [];
    const topRooms = reportData?.top_rooms || [];
    const topVip = reportData?.top_vip_customers || [];

    // Tính toán dữ liệu PieChart theo tab được chọn
    const activePieData = useMemo(() => {
        if (pieTab === 'category') {
            return revenueByCategory.map((c, idx) => ({
                name: c.name || c.category_name,
                value: c.revenue,
                percentage: c.percentage,
                booking_count: c.booking_count,
                color: c.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
            }));
        } else {
            return roomStatus.map((s) => ({
                name: s.name || s.label,
                value: s.count,
                percentage: s.percentage,
                color: s.color
            }));
        }
    }, [pieTab, revenueByCategory, roomStatus]);

    // Dữ liệu Top Phòng cho BarChart ngang
    const topRoomsChartData = useMemo(() => {
        return topRooms.map((r) => ({
            name: r.room_number || `P.${r.room_id}`,
            booking_count: r.booking_count,
            revenue: r.total_revenue,
            category: r.category_name,
            floor: r.floor
        }));
    }, [topRooms]);

    return (
        <div className="space-y-6 print:w-full print:m-0 print:p-0">
            {/* ========================================================================= */}
            {/* PHẦN 1: HEADER & BỘ LỌC THỜI GIAN                                          */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:border-none print:p-0 print:shadow-none print:mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                        Báo Cáo & Phân Tích Chuyên Sâu
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>Giám sát thời gian thực dòng tiền, công suất buồng phòng & hành vi chi tiêu</span>
                        {lastUpdated && (
                            <span className="hidden sm:inline text-slate-400 font-mono">
                                • Cập nhật: {lastUpdated.toLocaleTimeString('vi-VN')}
                            </span>
                        )}
                    </p>
                </div>

                {/* Bộ lọc Dropdown + Nút Làm mới */}
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                    {/* Dropdown Bộ lọc thời gian */}
                    <div className="relative inline-flex items-center">
                        <select
                            id="reports-time-filter"
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                            disabled={isLoading}
                            className="appearance-none bg-slate-900 text-white font-semibold text-xs sm:text-sm pl-4 pr-10 py-2.5 rounded-xl border border-slate-800 shadow-md shadow-slate-900/10 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer transition"
                        >
                            <option value="day">Hôm nay</option>
                            <option value="week">Tuần này (7 ngày)</option>
                            <option value="month">Tháng này (30 ngày)</option>
                            <option value="year">Năm nay (12 tháng)</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                    </div>

                    {/* Nút Làm mới */}
                    <button
                        type="button"
                        onClick={() => loadReportData(true)}
                        disabled={isLoading || isRefreshing}
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
                        title="Tải lại dữ liệu mới nhất"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>

                    {/* Nút Xuất Báo Cáo */}
                    <div className="relative inline-block text-left">
                        <button
                            type="button"
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                            title="Xuất báo cáo dưới dạng Excel / CSV hoặc In"
                        >
                            <Download className="w-4 h-4" />
                            <span>Xuất báo cáo</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isExportOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fadeIn">
                                <button
                                    type="button"
                                    onClick={handleExportCSV}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition text-left cursor-pointer"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                    <span>Tải file Excel / CSV</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition text-left cursor-pointer"
                                >
                                    <Printer className="w-4 h-4 text-blue-600" />
                                    <span>In báo cáo / Lưu PDF</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Thông báo lỗi nếu có */}
            {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{errorMessage}</span>
                    </div>
                    <button
                        onClick={() => loadReportData(false)}
                        className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition"
                    >
                        Thử lại
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* PHẦN 2: THẺ KPI (4 Ô HIỂN THỊ SỐ TỔNG NỔI BẬT)                            */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* KPI 1: TỔNG DOANH THU TRONG KỲ */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-blue-400/60 hover:shadow-md transition">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:scale-110"></div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Doanh Thu Trong Kỳ
                        </span>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif">
                            {isLoading ? (
                                <div className="h-7 w-32 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                                formatVND(summary.total_revenue)
                            )}
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-xs">
                            {summary.growth_rate >= 0 ? (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                                    <TrendingUp className="w-3 h-3" />
                                    +{summary.growth_rate}%
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 text-[11px]">
                                    <TrendingDown className="w-3 h-3" />
                                    {summary.growth_rate}%
                                </span>
                            )}
                            <span className="text-slate-400 text-[11px] truncate">
                                {summary.prev_label || 'so với kỳ trước'}
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span>Lũy kế toàn thời gian:</span>
                            <strong className="text-slate-700 font-medium">
                                {formatVND(summary.all_time_revenue)}
                            </strong>
                        </div>
                    </div>
                </div>

                {/* KPI 2: TỔNG SỐ LƯỢT ĐẶT PHÒNG (BOOKINGS) */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-amber-400/60 hover:shadow-md transition">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:scale-110"></div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Số Lượng Booking
                        </span>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif">
                            {isLoading ? (
                                <div className="h-7 w-24 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                                `${summary.total_bookings ?? 0} đơn`
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="text-[11px]">Đã ghi nhận trong kỳ lọc</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span>Tổng đơn toàn hệ thống:</span>
                            <strong className="text-slate-700 font-medium">
                                {summary.all_time_bookings ?? 0} đơn
                            </strong>
                        </div>
                    </div>
                </div>

                {/* KPI 3: CÔNG SUẤT PHÒNG HIỆN TẠI (OCCUPANCY RATE) */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-emerald-400/60 hover:shadow-md transition">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:scale-110"></div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Công Suất Phòng
                        </span>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
                            <BedDouble className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif flex items-baseline gap-2">
                            {isLoading ? (
                                <div className="h-7 w-20 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                                <>
                                    <span>{summary.occupancy_rate ?? 0}%</span>
                                    <span className="text-xs font-normal text-slate-400">
                                        ({summary.occupied_rooms ?? 0}/{summary.total_rooms ?? 0} phòng)
                                    </span>
                                </>
                            )}
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(summary.occupancy_rate || 0, 100)}%` }}
                            ></div>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span>Phòng trống sẵn sàng:</span>
                            <strong className="text-emerald-600 font-bold">
                                {summary.available_rooms ?? 0} phòng
                            </strong>
                        </div>
                    </div>
                </div>

                {/* KPI 4: GIÁ TRỊ ĐƠN TRUNG BÌNH (AOV) */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-purple-400/60 hover:shadow-md transition">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-pink-500/5 rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:scale-110"></div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Giá Trị Đơn TB (AOV)
                        </span>
                        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
                            <Award className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif">
                            {isLoading ? (
                                <div className="h-7 w-32 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                                formatVND(summary.average_order_value)
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                            <span className="text-[11px]">Bình quân trên mỗi lượt đặt</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span>Đang dọn / Bảo trì:</span>
                            <strong className="text-amber-600 font-medium">
                                {(summary.cleaning_rooms || 0) + (summary.maintenance_rooms || 0)} phòng
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* PHẦN 3: BIỂU ĐỒ CHÍNH (MAIN CHART: DOANH THU THEO THỜI GIAN)               */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                Biểu Đồ Doanh Thu Trực Quan
                            </h2>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {reportData?.filter_label || 'Theo thời gian'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Trục X thể hiện mốc thời gian, trục Y hiển thị số tiền thanh toán thực tế (VNĐ)
                        </p>
                    </div>

                    {/* Toggle giữa AreaChart và BarChart */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60">
                        <button
                            type="button"
                            onClick={() => setChartType('area')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                chartType === 'area'
                                    ? 'bg-white text-blue-600 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Đường Vùng</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartType('bar')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                chartType === 'bar'
                                    ? 'bg-white text-blue-600 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Cột</span>
                        </button>
                    </div>
                </div>

                {/* Khung vẽ Recharts */}
                <div className="w-full h-72 sm:h-84">
                    {isLoading ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="text-xs font-semibold">Đang tổng hợp dữ liệu doanh thu...</span>
                        </div>
                    ) : revenueChart.length === 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                            <Calendar className="w-8 h-8 text-slate-300" />
                            <span className="text-xs font-semibold text-slate-600">Chưa có giao dịch trong mốc thời gian này</span>
                            <span className="text-[11px] text-slate-400">Vui lòng chọn mốc thời gian khác để xem biểu đồ</span>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'area' ? (
                                <AreaChart data={revenueChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatShortVND}
                                        width={48}
                                    />
                                    <Tooltip content={<CustomRevenueTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        name="Doanh thu (VNĐ)"
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#revenueGradient)"
                                        activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            ) : (
                                <BarChart data={revenueChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatShortVND}
                                        width={48}
                                    />
                                    <Tooltip content={<CustomRevenueTooltip />} />
                                    <Bar
                                        dataKey="revenue"
                                        name="Doanh thu (VNĐ)"
                                        fill="#2563eb"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={48}
                                    />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* PHẦN 4: KHỐI BIỂU ĐỒ PHỤ (GRID 2 CỘT)                                      */}
            {/* Cột 1: PieChart (Doanh thu theo Loại phòng / Trạng thái phòng)             */}
            {/* Cột 2: BarChart (Top phòng được đặt nhiều nhất)                           */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* CỘT 1: BIỂU ĐỒ TRÒN (PIECHART) */}
                <div className="lg:col-span-6 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                    Cơ Cấu Tỷ Trọng
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {pieTab === 'category' ? 'Phân bổ doanh thu theo từng hạng phòng' : 'Hiện trạng buồng phòng thực tế'}
                                </p>
                            </div>

                            {/* Toggle tab giữa Loại phòng và Trạng thái */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60">
                                <button
                                    type="button"
                                    onClick={() => setPieTab('category')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        pieTab === 'category'
                                            ? 'bg-white text-blue-600 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Loại phòng
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPieTab('room_status')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        pieTab === 'room_status'
                                            ? 'bg-white text-blue-600 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Trạng thái
                                </button>
                            </div>
                        </div>

                        {/* PieChart Canvas */}
                        <div className="h-60 sm:h-64 relative flex items-center justify-center">
                            {isLoading ? (
                                <div className="text-slate-400 text-xs font-semibold flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                                    <span>Đang vẽ biểu đồ tròn...</span>
                                </div>
                            ) : activePieData.length === 0 ? (
                                <div className="text-slate-400 text-xs">Không có dữ liệu hiển thị</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={activePieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={85}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {activePieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Danh sách chú giải chi tiết bên dưới */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                        {activePieData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                                    <span className="truncate text-slate-700 font-medium">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <span className="font-bold text-slate-900">
                                        {pieTab === 'category' ? formatVND(item.value) : `${item.value} phòng`}
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        {item.percentage}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CỘT 2: BARCHART TOP PHÒNG ĐƯỢC ĐẶT NHIỀU NHẤT */}
                <div className="lg:col-span-6 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                    Top 5 Phòng Được Đặt Nhiều Nhất
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Thống kê tần suất buồng phòng có hiệu suất khai thác cao nhất
                                </p>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Top 5
                            </span>
                        </div>

                        {/* BarChart Canvas (Cột nằm ngang) */}
                        <div className="h-60 sm:h-64">
                            {isLoading ? (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                                    <span>Đang xếp hạng buồng phòng...</span>
                                </div>
                            ) : topRoomsChartData.length === 0 ? (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                    Chưa có dữ liệu phòng được đặt
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={topRoomsChartData}
                                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis
                                            type="number"
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            stroke="#475569"
                                            fontSize={12}
                                            fontWeight={600}
                                            tickLine={false}
                                            axisLine={false}
                                            width={60}
                                        />
                                        <Tooltip
                                            formatter={(value, name, props) => [
                                                `${value} lượt đặt (${formatVND(props.payload.revenue)})`,
                                                'Hiệu suất'
                                            ]}
                                            contentStyle={{
                                                backgroundColor: '#0f172a',
                                                border: '1px solid #334155',
                                                borderRadius: '0.75rem',
                                                fontSize: '12px',
                                                color: '#fff'
                                            }}
                                        />
                                        <Bar
                                            dataKey="booking_count"
                                            name="Lượt đặt"
                                            fill="#4f46e5"
                                            radius={[0, 8, 8, 0]}
                                            barSize={20}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Danh sách tóm tắt Top Phòng bên dưới */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                        {topRooms.slice(0, 3).map((r, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 bg-slate-50/70 px-3 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                                        #{idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <strong className="text-slate-900 block truncate">{r.name} - Tầng {r.floor}</strong>
                                        <span className="text-[10px] text-slate-500 block truncate">{r.category_name}</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-bold text-emerald-600">{formatVND(r.total_revenue)}</div>
                                    <span className="text-[10px] text-slate-400 font-medium">{r.booking_count} lượt đặt</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* PHẦN 5: BẢNG XẾP HẠNG TOP KHÁCH HÀNG VIP                                  */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Crown className="w-5 h-5 text-amber-500" />
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                Bảng Xếp Hạng Khách Hàng VIP
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Top 5 khách hàng có tổng chi tiêu cao nhất và đóng góp doanh thu lớn nhất cho khách sạn
                        </p>
                    </div>
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 self-start sm:self-auto flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        Hạng Thành Viên Cao Cấp
                    </span>
                </div>

                {/* Table Top VIP */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="py-3 px-5 text-center w-16">THỨ HẠNG</th>
                                <th className="py-3 px-5">KHÁCH HÀNG</th>
                                <th className="py-3 px-5">LIÊN HỆ</th>
                                <th className="py-3 px-5">HẠNG THẺ VIP</th>
                                <th className="py-3 px-5 text-center">LƯỢT ĐẶT</th>
                                <th className="py-3 px-5 text-right">TỔNG CHI TIÊU (VNĐ)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400">
                                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        <span>Đang tải danh sách VIP...</span>
                                    </td>
                                </tr>
                            ) : topVip.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-10 text-center text-slate-400">
                                        Chưa có dữ liệu chi tiêu khách hàng
                                    </td>
                                </tr>
                            ) : (
                                topVip.map((customer) => {
                                    // Rank styling
                                    const rankBadge =
                                        customer.rank === 1
                                            ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/30 ring-2 ring-amber-300'
                                            : customer.rank === 2
                                                ? 'bg-slate-300 text-slate-900 font-black shadow-xs'
                                                : customer.rank === 3
                                                    ? 'bg-amber-700/80 text-white font-black'
                                                    : 'bg-slate-100 text-slate-600 font-bold';

                                    // VIP Tier Badge
                                    const tierBadge =
                                        customer.vip_tier === 'Diamond'
                                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                                            : customer.vip_tier === 'Platinum'
                                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                : customer.vip_tier === 'Gold'
                                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                                    : 'bg-slate-100 text-slate-700 border-slate-200';

                                    return (
                                        <tr
                                            key={customer.id}
                                            className="hover:bg-slate-50/80 transition group"
                                        >
                                            {/* Thứ hạng */}
                                            <td className="py-3.5 px-5 text-center">
                                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs ${rankBadge}`}>
                                                    {customer.rank}
                                                </span>
                                            </td>

                                            {/* Khách hàng Avatar + Name */}
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-3">
                                                    {customer.avatar ? (
                                                        <img
                                                            src={customer.avatar}
                                                            alt={customer.full_name}
                                                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                                                            {customer.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <strong className="text-slate-900 text-xs font-bold block truncate group-hover:text-blue-600 transition">
                                                            {customer.full_name}
                                                        </strong>
                                                        <span className="text-[11px] text-slate-400 block truncate font-mono">
                                                            @{customer.username}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Liên hệ Phone + Email */}
                                            <td className="py-3.5 px-5">
                                                <div className="space-y-0.5 text-[11px]">
                                                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        <span>{customer.phone_number || '—'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <Mail className="w-3 h-3 text-slate-400" />
                                                        <span className="truncate max-w-[150px]">{customer.email || '—'}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Hạng thẻ VIP */}
                                            <td className="py-3.5 px-5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${tierBadge}`}>
                                                    <Crown className="w-3 h-3" />
                                                    {customer.vip_tier}
                                                </span>
                                            </td>

                                            {/* Lượt đặt phòng */}
                                            <td className="py-3.5 px-5 text-center">
                                                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
                                                    {customer.booking_count} đơn
                                                </span>
                                            </td>

                                            {/* Tổng chi tiêu */}
                                            <td className="py-3.5 px-5 text-right">
                                                <div className="font-black text-emerald-600 text-sm font-serif">
                                                    {formatVND(customer.total_spent)}
                                                </div>
                                                <span className="text-[10px] text-slate-400">
                                                    Đã thanh toán
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
