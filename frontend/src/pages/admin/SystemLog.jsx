import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../store/authStore';
import { auditLogService } from '../../services/auditLogService';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function SystemLog() {
  const { user: currentUser } = useAuth();

  // State danh sách log, phân trang và trạng thái
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // State các bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  // Chuẩn hóa role của người đăng nhập hiện tại
  const currentRole = useMemo(() => {
    return (currentUser?.role || '').toUpperCase();
  }, [currentUser]);

  // Kiểm tra phân quyền truy cập: Chỉ ADMIN, OWNER, MANAGER mới có quyền xem Audit Log
  const hasAccess = useMemo(() => {
    return ['ADMIN', 'OWNER', 'MANAGER'].includes(currentRole);
  }, [currentRole]);

  // Hàm tải dữ liệu log từ Backend
  const fetchLogs = useCallback(async () => {
    if (!hasAccess) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const params = {
        page: page,
        page_size: pageSize,
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedRole) params.role = selectedRole;
      if (selectedModule) params.module = selectedModule;
      if (selectedAction) params.action = selectedAction;

      const res = await auditLogService.getLogs(params);
      if (res && Array.isArray(res.results)) {
        setLogs(res.results);
        setTotalCount(res.count || res.results.length);
      } else if (Array.isArray(res)) {
        setLogs(res);
        setTotalCount(res.length);
      } else {
        setLogs([]);
        setTotalCount(0);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setErrorMsg('Bạn không có thẩm quyền truy cập Nhật ký kiểm toán hệ thống.');
      } else {
        setErrorMsg('Không thể tải dữ liệu nhật ký. Vui lòng kiểm tra lại kết nối!');
      }
    } finally {
      setLoading(false);
    }
  }, [hasAccess, page, pageSize, searchTerm, selectedRole, selectedModule, selectedAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Xử lý đổi trang
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Render Badge Hành động theo màu quy định
  const renderActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    switch (act) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            CREATE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            DELETE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            {act || 'OTHER'}
          </span>
        );
    }
  };

  // Render Module Badge
  const renderModuleBadge = (module, moduleDisplay) => {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
        <Layers className="w-3.5 h-3.5 text-blue-500" />
        {moduleDisplay || module}
      </span>
    );
  };

  // Định dạng ngày giờ chuẩn Việt Nam
  const formatDateTime = (isoString) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Màn hình 403 Forbidden nếu không đủ cấp bậc
  if (!hasAccess) {
    return (
      <div className="min-h-[420px] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-rose-100 p-8 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Truy cập bị từ chối (403)</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Bạn không có thẩm quyền truy cập Nhật ký thao tác hệ thống (Separation of Duties). Chỉ Admin IT, Chủ khách sạn (Owner) và Quản lý (Manager) mới có thể xem trang này.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3">
      
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Nhật Ký Thao Tác Hệ Thống
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Phân tách trách nhiệm (Separation of Duties) — Vai trò hiện tại:{' '}
              <span className="font-semibold text-blue-600">{currentRole}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setPage(1);
            fetchLogs();
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Thông báo lỗi nếu có */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Bộ Lọc Thông Minh (Smart Filters Bar) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          Bộ Lọc Tra Cứu
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Thanh tìm kiếm tên nhân viên / mô tả */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên nhân viên, mô tả..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-slate-400"
            />
          </div>

          {/* 2. Dropdown Lọc Chức vụ (Role) với Logic UI Ẩn Option theo Separation of Duties */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            >
              <option value="">-- Tất cả Chức vụ --</option>

              {/* Chỉ ADMIN mới thấy tuỳ chọn lọc ADMIN */}
              {currentRole === 'ADMIN' && (
                <option value="admin">Quản trị IT (Admin)</option>
              )}

              {/* OWNER và ADMIN mới thấy tuỳ chọn lọc OWNER; MANAGER bị ẩn */}
              {(currentRole === 'ADMIN' || currentRole === 'OWNER') && (
                <option value="owner">Chủ khách sạn (Owner)</option>
              )}

              {/* Các cấp dưới trực tiếp: Cả ADMIN, OWNER, MANAGER đều lọc được */}
              <option value="manager">Quản lý (Manager)</option>
              <option value="cashier">Thu ngân / Kế toán</option>
              <option value="receptionist">Lễ tân</option>
              <option value="housekeeper">Nhân viên Buồng phòng</option>
              <option value="service_staff">Nhân viên Dịch vụ</option>
              <option value="technician">Kỹ thuật viên</option>
            </select>
          </div>

          {/* 3. Dropdown Lọc Phân hệ (Module) */}
          <div>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            >
              <option value="">-- Tất cả Phân hệ --</option>
              <option value="BOOKING">Đặt phòng</option>
              <option value="INVOICE">Hóa đơn & Thu ngân</option>
              <option value="USER">Nhân sự & Người dùng</option>
              <option value="ROOM">Buồng phòng</option>
              <option value="SERVICE">Dịch vụ</option>
              <option value="PROMOTION">Khuyến mãi</option>
              <option value="SYSTEM">Cài đặt Hệ thống</option>
            </select>
          </div>

          {/* 4. Dropdown Lọc Hành động (Action) */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            >
              <option value="">-- Tất cả Hành động --</option>
              <option value="CREATE">CREATE (Tạo mới)</option>
              <option value="UPDATE">UPDATE (Cập nhật)</option>
              <option value="DELETE">DELETE (Xóa)</option>
              <option value="LOGIN">LOGIN (Đăng nhập)</option>
              <option value="LOGOUT">LOGOUT (Đăng xuất)</option>
              <option value="EXPORT">EXPORT (Xuất dữ liệu)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bảng Dữ Liệu (Audit Log Table) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Thời Gian</th>
                <th className="py-3.5 px-4">Người Thực Hiện</th>
                <th className="py-3.5 px-4">Hành Động</th>
                <th className="py-3.5 px-4">Phân Hệ</th>
                <th className="py-3.5 px-4">Chi Tiết Mô Tả</th>
                <th className="py-3.5 px-4">Địa Chỉ IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Đang nạp nhật ký kiểm toán...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                    Không tìm thấy thao tác nào phù hợp.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 transition-colors duration-150"
                  >
                    {/* Cột 1: Thời gian */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateTime(log.created_at)}
                      </div>
                    </td>

                    {/* Cột 2: Người thực hiện (Tên in đậm, Chức vụ in nghiêng bên dưới) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold border border-slate-200">
                          {log.username ? log.username.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 leading-tight">
                            {log.user_full_name || log.username || 'Hệ thống'}
                          </p>
                          <p className="text-xs italic text-slate-400 mt-0.5">
                            {log.user_role_display || (log.user_role ? log.user_role.toUpperCase() : 'Hệ thống')}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Cột 3: Hành động (Badge màu Xanh lá cho CREATE, Vàng cho UPDATE, Đỏ cho DELETE) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderActionBadge(log.action)}
                    </td>

                    {/* Cột 4: Module */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderModuleBadge(log.module, log.module_display)}
                    </td>

                    {/* Cột 5: Chi tiết mô tả */}
                    <td className="py-3.5 px-4 text-slate-700 min-w-[280px]">
                      <p className="text-xs sm:text-sm line-clamp-2" title={log.description}>
                        {log.description}
                      </p>
                    </td>

                    {/* Cột 6: Địa chỉ IP */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Phân Trang */}
        <div className="py-3.5 px-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Hiển thị <strong>{logs.length}</strong> / <strong>{totalCount}</strong> bản ghi
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-slate-700">
                Trang {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
