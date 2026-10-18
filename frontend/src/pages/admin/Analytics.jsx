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
    FileSpreadsheet,
    CreditCard,
    Briefcase,
    Percent,
    Banknote,
    ShieldCheck,
    Wallet,
    Tag
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

        csv += '1. TỔNG QUAN CHỈ SỐ CHÍNH (HOTEL PMS KEY METRICS)\n';
        csv += `Tổng doanh thu trong kỳ:,${sum.total_revenue || 0} VND\n`;
        csv += `Tăng trưởng so với kỳ trước:,${sum.growth_rate || 0}%\n`;
        csv += `Tổng số lượt đặt phòng (Bookings):,${sum.total_bookings || 0} lượt\n`;
        csv += `Tỉ lệ lấp đầy phòng (Occupancy):,${sum.occupancy_rate || 0}%\n`;
        csv += `Giá bán phòng bình quân (ADR):,${sum.adr || 0} VND/đêm\n`;
        csv += `Doanh thu trên mỗi phòng sẵn có (RevPAR):,${sum.revpar || 0} VND/phòng\n`;
        csv += `Thời gian lưu trú trung bình (ALOS):,${sum.alos || 1.0} đêm\n`;
        csv += `Số đêm phòng đã bán:,${sum.sold_room_nights || 0} đêm\n`;
        csv += `Giá trị đơn trung bình (AOV):,${sum.average_order_value || 0} VND\n\n`;

        // Cơ cấu Kênh thanh toán
        const pMethods = reportData?.payment_methods || [];
        if (pMethods.length > 0) {
            csv += '2. CƠ CẤU KÊNH THANH TOÁN (PAYMENT METHODS)\n';
            csv += 'Kênh thanh toán,Số tiền (VND),Số giao dịch,Tỷ trọng (%)\n';
            pMethods.forEach((pm) => {
                csv += `"${pm.name}",${pm.amount || 0},${pm.count || 0},${pm.percentage || 0}%\n`;
            });
            csv += '\n';
        }

        // Top Doanh nghiệp Đối tác B2B
        const topCorp = reportData?.top_corporate_partners || [];
        if (topCorp.length > 0) {
            csv += '3. TOP DOANH NGHIỆP ĐỐI TÁC B2B\n';
            csv += 'Hạng,Tên doanh nghiệp,Mã đối tác,MST,Người liên hệ,Số đoàn,Tổng doanh thu (VND)\n';
            topCorp.forEach((cp, idx) => {
                csv += `${idx + 1},"${cp.company_name}","${cp.corporate_code}","${cp.tax_code}","${cp.contact_person}",${cp.total_groups || 0},${cp.total_revenue || 0}\n`;
            });
            csv += '\n';
        }

        csv += '4. CHI TIẾT DOANH THU THEO MỐC THỜI GIAN\n';
        csv += 'Thời gian,Doanh thu (VND),Số lượt đặt\n';
        revChart.forEach((item) => {
            csv += `"${item.full_date || item.label}",${item.revenue || 0},${item.booking_count || 0}\n`;
        });
        csv += '\n';

        csv += '5. TOP 5 PHÒNG ĐƯỢC ĐẶT NHIỀU NHẤT\n';
        csv += 'Hạng,Số phòng,Loại phòng,Số lượt đặt,Doanh thu mang lại (VND)\n';
        topR.forEach((r, idx) => {
            csv += `${idx + 1},"${r.room_number}","${r.category_name || ''}",${r.booking_count || 0},${r.revenue || 0}\n`;
        });
        csv += '\n';

        csv += '6. TOP 5 KHÁCH HÀNG VIP CHI TIÊU CAO NHẤT\n';
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
    const paymentMethods = reportData?.payment_methods || [];
    const revenueMix = reportData?.revenue_mix || [];
    const customerSegments = reportData?.customer_segments || [];
    const topCorporatePartners = reportData?.top_corporate_partners || [];

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:mb-4">
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
                        <span className="hidden print:inline text-slate-600 font-semibold font-mono">
                            • Kỳ báo cáo: {reportData?.filter_label || timeFilter}
                        </span>
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
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm rounded-xl border border-slate-200 shadow-xs transition cursor-pointer disabled:opacity-50"
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
            {/* PHẦN 2: THẺ KPI CHUYÊN SÂU (6 CHỈ SỐ VÀNG HOTEL BUSINESS INTELLIGENCE)      */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* KPI 1: TỔNG DOANH THU TRONG KỲ */}
                <div 
                    className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-blue-400/60 hover:shadow-md transition"
                    title="Doanh thu kế toán ghi nhận từ các hóa đơn đã thanh toán & hoàn tất trả phòng trong kỳ chọn"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:scale-110"></div>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Doanh Thu Trong Kỳ
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Hóa đơn đã quyết toán</span>
                        </div>
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

                {/* KPI 2: GIÁ BÁN PHÒNG BÌNH QUÂN (ADR - AVERAGE DAILY RATE) */}
                <div 
                    className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-cyan-400/60 hover:shadow-md transition"
                    title="Giá bán phòng bình quân mỗi ngày (ADR = Tổng tiền phòng / Số đêm phòng đã bán)"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:scale-110"></div>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Giá Bán TB (ADR)
                            </span>
                            <span className="text-[10px] text-cyan-700 bg-cyan-50 font-bold px-1.5 py-0.5 rounded border border-cyan-200/60">
                                Average Daily Rate
                            </span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200/60 flex items-center justify-center text-cyan-600">
                            <Banknote className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif">
                            {isLoading ? (
                                <div className="h-7 w-32 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                                formatVND(summary.adr)
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                            <span className="text-[11px]">Bình quân giá bán trên mỗi đêm</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span>Đêm phòng đã bán:</span>
                            <strong className="text-cyan-700 font-bold">
                                {summary.sold_room_nights ?? 0} đêm
                            </strong>
                        </div>
                    </div>
                </div>

                {/* KPI 3: DOANH THU TRÊN MỖI PHÒNG SẴN CÓ (RevPAR) */}
                <div 
                    className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-indigo-400/60 hover:shadow-md transition"
                    title="Doanh thu trên mỗi phòng sẵn có (RevPAR = Doanh thu phòng / Tổng số phòng khả dụng)"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:scale-110"></div>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Doanh Thu / Phòng (RevPAR)
                            </span>
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-200/60">
                                Rev. Per Avail. Room
                            </span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif">
                            {isLoading ? (
                                <div className="h-7 w-32 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                                formatVND(summary.revpar)
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                            <span className="text-[11px]">Chỉ số hiệu quả buồng phòng</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span>Lưu trú TB (ALOS):</span>
                            <strong className="text-indigo-700 font-bold">
                                {summary.alos ?? 1.0} đêm/khách
                            </strong>
                        </div>
                    </div>
                </div>

                {/* KPI 4: TỔNG SỐ LƯỢT ĐẶT PHÒNG (BOOKINGS) */}
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

                {/* KPI 5: CÔNG SUẤT PHÒNG HIỆN TẠI (OCCUPANCY RATE) */}
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

                {/* KPI 6: GIÁ TRỊ ĐƠN TRUNG BÌNH (AOV) */}
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
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60 print:hidden">
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
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60 print:hidden">
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
            {/* PHẦN 4.5: CƠ CẤU KÊNH THANH TOÁN & PHÂN KHÚC KHÁCH HÀNG (B2C VS B2B)       */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CỘT 1: CƠ CẤU KÊNH THANH TOÁN */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                        Cơ Cấu Kênh Thanh Toán
                                    </h2>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Phân bổ dòng tiền thu qua VietQR SePay, tiền mặt & thẻ
                                </p>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                Cổng thanh toán
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="py-12 text-center text-slate-400">
                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                <span className="text-xs">Đang tổng hợp kênh thanh toán...</span>
                            </div>
                        ) : paymentMethods.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 text-xs">
                                Chưa có giao dịch thanh toán trong kỳ
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {paymentMethods.map((pm, idx) => {
                                    const iconBg =
                                        pm.code === 'VIETQR' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                        pm.code === 'CASH' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                        pm.code === 'CARD' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                        'bg-pink-50 text-pink-600 border-pink-200';

                                    const barGradient =
                                        pm.code === 'VIETQR' ? 'from-blue-600 to-indigo-600' :
                                        pm.code === 'CASH' ? 'from-emerald-500 to-teal-500' :
                                        pm.code === 'CARD' ? 'from-purple-600 to-indigo-600' :
                                        'from-pink-500 to-rose-500';

                                    return (
                                        <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/60 border border-slate-100 hover:border-slate-200 transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${iconBg}`}>
                                                        {pm.code === 'VIETQR' && <ShieldCheck className="w-4 h-4" />}
                                                        {pm.code === 'CASH' && <Banknote className="w-4 h-4" />}
                                                        {pm.code === 'CARD' && <CreditCard className="w-4 h-4" />}
                                                        {pm.code === 'EWALLET' && <Wallet className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-900 block">
                                                            {pm.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {pm.count} giao dịch
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-black text-slate-900">
                                                        {formatVND(pm.amount)}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                                        {pm.percentage}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700`}
                                                    style={{ width: `${Math.min(pm.percentage || 0, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            Đối soát SePay Webhook tự động
                        </span>
                        <span className="font-bold text-slate-800">
                            {formatVND(paymentMethods.reduce((acc, curr) => acc + (curr.amount || 0), 0))}
                        </span>
                    </div>
                </div>

                {/* CỘT 2: PHÂN KHÚC KHÁCH HÀNG & CƠ CẤU NGUỒN THU */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                        Phân Khúc Khách & Nguồn Thu
                                    </h2>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Tỷ trọng B2C vs B2B và Phân bổ Tiền phòng vs Tiện ích F&B
                                </p>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                                Phân bổ doanh số
                            </span>
                        </div>

                        {/* SUB-SECTION 1: KHÁCH LẺ (B2C) VS ĐOÀN DOANH NGHIỆP (B2B) */}
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Phân khúc Khách hàng (B2C vs B2B)
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    {customerSegments.reduce((sum, s) => sum + (s.count || 0), 0)} lượt đoàn/khách
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                {customerSegments.map((seg, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-2xl border ${
                                            seg.code === 'B2B'
                                                ? 'bg-amber-50/50 border-amber-200/80'
                                                : 'bg-blue-50/50 border-blue-200/80'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                {seg.code === 'B2B' ? (
                                                    <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                                                ) : (
                                                    <Users className="w-3.5 h-3.5 text-blue-600" />
                                                )}
                                                {seg.name}
                                            </span>
                                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                                seg.code === 'B2B' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {seg.percentage}%
                                            </span>
                                        </div>
                                        <div className="text-base font-black text-slate-900 font-serif">
                                            {formatVND(seg.amount)}
                                        </div>
                                        <span className="text-[10px] text-slate-500">
                                            {seg.count} {seg.code === 'B2B' ? 'đoàn hội nghị/tour' : 'lượt đặt phòng lẻ'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Stacked bar B2C vs B2B */}
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                                {customerSegments.map((seg, idx) => (
                                    <div
                                        key={idx}
                                        style={{ width: `${seg.percentage || 0}%`, backgroundColor: seg.color }}
                                        title={`${seg.name}: ${seg.percentage}%`}
                                        className="h-full transition-all duration-700"
                                    ></div>
                                ))}
                            </div>
                        </div>

                        {/* SUB-SECTION 2: TIỀN PHÒNG VS DỊCH VỤ F&B */}
                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Cơ cấu Nguồn thu (Phòng & Dịch vụ)
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    Tổng thực thu kỳ
                                </span>
                            </div>

                            <div className="space-y-2">
                                {revenueMix.map((mix, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: mix.color }}
                                            ></span>
                                            <span className="font-semibold text-slate-700">{mix.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900">{formatVND(mix.amount)}</span>
                                            <span className="text-[10px] font-bold text-slate-400 w-10 text-right">
                                                {mix.percentage}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Stacked bar Room vs Service */}
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex mt-2.5">
                                {revenueMix.map((mix, idx) => (
                                    <div
                                        key={idx}
                                        style={{ width: `${mix.percentage || 0}%`, backgroundColor: mix.color }}
                                        title={`${mix.name}: ${mix.percentage}%`}
                                        className="h-full transition-all duration-700"
                                    ></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="text-[11px]">Định hướng: Mở rộng hợp đồng B2B gia tăng RevPAR</span>
                        <span className="font-bold text-emerald-600">
                            {formatVND(revenueMix.reduce((acc, curr) => acc + (curr.amount || 0), 0))}
                        </span>
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

            {/* ========================================================================= */}
            {/* PHẦN 6: BẢNG XẾP HẠNG TOP DOANH NGHIỆP ĐỐI TÁC (B2B CORPORATE PARTNERS)   */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                Top Doanh Nghiệp Đối Tác (B2B Corporate Partners)
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Các công ty, tập đoàn lữ hành & đối tác sự kiện M.I.C.E có đóng góp doanh thu lớn nhất
                        </p>
                    </div>
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200/80 self-start sm:self-auto flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                        Hợp Đồng Đoàn & Sự Kiện
                    </span>
                </div>

                {/* Table Top B2B Partners */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="py-3 px-5 text-center w-16">THỨ HẠNG</th>
                                <th className="py-3 px-5">DOANH NGHIỆP / CÔNG TY</th>
                                <th className="py-3 px-5">MÃ HỢP ĐỒNG & ƯU ĐÃI</th>
                                <th className="py-3 px-5">ĐẠI DIỆN LIÊN HỆ</th>
                                <th className="py-3 px-5 text-center">SỐ ĐOÀN ĐÃ TỔ CHỨC</th>
                                <th className="py-3 px-5 text-right">TỔNG DOANH THU ĐÓNG GÓP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        <span>Đang tải danh sách doanh nghiệp đối tác...</span>
                                    </td>
                                </tr>
                            ) : topCorporatePartners.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-10 text-center text-slate-400">
                                        Chưa có dữ liệu đặt phòng đoàn doanh nghiệp
                                    </td>
                                </tr>
                            ) : (
                                topCorporatePartners.map((partner) => {
                                    const rankBadge =
                                        partner.rank === 1
                                            ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/30 ring-2 ring-amber-300'
                                            : partner.rank === 2
                                                ? 'bg-slate-300 text-slate-900 font-black shadow-xs'
                                                : partner.rank === 3
                                                    ? 'bg-amber-700/80 text-white font-black'
                                                    : 'bg-slate-100 text-slate-600 font-bold';

                                    return (
                                        <tr
                                            key={partner.id}
                                            className="hover:bg-slate-50/80 transition group"
                                        >
                                            {/* Thứ hạng */}
                                            <td className="py-3.5 px-5 text-center">
                                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs ${rankBadge}`}>
                                                    {partner.rank}
                                                </span>
                                            </td>

                                            {/* Tên công ty & Mã số thuế */}
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                                                        <Building2 className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <strong className="text-slate-900 text-xs font-bold block truncate group-hover:text-indigo-600 transition">
                                                            {partner.company_name}
                                                        </strong>
                                                        <span className="text-[11px] text-slate-400 block truncate font-mono">
                                                            MST: {partner.tax_code}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Mã Hợp đồng & Ưu đãi */}
                                            <td className="py-3.5 px-5">
                                                <div className="space-y-1">
                                                    <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                                                        <Tag className="w-3 h-3 text-indigo-500" />
                                                        {partner.corporate_code}
                                                    </span>
                                                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                                        <Percent className="w-3 h-3" />
                                                        Chiết khấu {partner.discount_percent}%
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Người đại diện liên hệ */}
                                            <td className="py-3.5 px-5">
                                                <div className="space-y-0.5 text-[11px]">
                                                    <div className="font-semibold text-slate-800 truncate max-w-[160px]">
                                                        {partner.contact_person}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-500">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        <span>{partner.contact_phone}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Số đoàn đã tổ chức */}
                                            <td className="py-3.5 px-5 text-center">
                                                <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-lg text-xs">
                                                    {partner.total_groups} đoàn
                                                </span>
                                            </td>

                                            {/* Tổng doanh thu */}
                                            <td className="py-3.5 px-5 text-right">
                                                <div className="font-black text-indigo-700 text-sm font-serif">
                                                    {formatVND(partner.total_revenue)}
                                                </div>
                                                <span className="text-[10px] text-slate-400">
                                                    Hóa đơn tổng đoàn
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
