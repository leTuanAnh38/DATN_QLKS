import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAppTheme } from '../../contexts/ThemeContext';
import { getSlaStatus, isTransportService, isHousekeepingService } from '../services/serviceHelpers';

type FilterPeriod = 'day' | 'week' | 'month';

export interface ExecutiveDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateTab: (route: '/(tabs)/housekeeping' | '/(tabs)/services' | '/(tabs)/maintenance' | '/(tabs)/lost_found') => void;
  onSelectVipGuest?: (guestId: number) => void;
}

interface OpsHotspots {
  checkoutInspectCount: number;
  overdueOrUnassignedServices: number;
  overdueServicesCount: number;
  fixingMaintenanceCount: number;
  unassignedMaintenanceCount: number;
  storedLostFoundCount: number;
}

const formatVnd = (amount?: number | null): string => {
  const num = Number(amount || 0);
  if (!isFinite(num)) return '0 đ';
  return `${Math.round(num).toLocaleString('vi-VN')} đ`;
};

const formatCompactVnd = (amount?: number | null): string => {
  const num = Number(amount || 0);
  if (!isFinite(num)) return '0 đ';
  if (Math.abs(num) >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2).replace(/\.00$/, '')} tỷ`;
  }
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')} tr`;
  }
  return `${Math.round(num).toLocaleString('vi-VN')} đ`;
};

export default function ExecutiveDashboardModal({
  visible,
  onClose,
  onNavigateTab,
  onSelectVipGuest,
}: ExecutiveDashboardModalProps) {
  const { colors, isDark, hotelName } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<FilterPeriod>('day');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [hotspots, setHotspots] = useState<OpsHotspots>({
    checkoutInspectCount: 0,
    overdueOrUnassignedServices: 0,
    overdueServicesCount: 0,
    fixingMaintenanceCount: 0,
    unassignedMaintenanceCount: 0,
    storedLostFoundCount: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (targetPeriod: FilterPeriod, isPull = false) => {
    if (isPull) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);

    try {
      const [reportRes, roomsRes, servicesRes, maintRes, lfRes] = await Promise.all([
        apiClient.get(`/reports/?filter=${targetPeriod}`),
        apiClient.get('/rooms/admin/rooms/').catch(() => null),
        apiClient.get('/services/requests/?no_page=true').catch(() => null),
        apiClient.get('/rooms/maintenance-tickets/').catch(() => null),
        apiClient.get('/rooms/lost-and-found/').catch(() => null),
      ]);

      if (reportRes?.data) {
        setReport(reportRes.data);
      }

      // Tính điểm nóng hiện trường thực tế từ các phân hệ vận hành
      const roomsList =
        roomsRes?.data?.results || roomsRes?.data?.rooms || roomsRes?.data?.data || roomsRes?.data || [];
      const roomsArr = Array.isArray(roomsList) ? roomsList : [];
      const checkoutInspectCount = roomsArr.filter(
        (r: any) => r.latest_minibar_check?.status === 'requested'
      ).length;

      const svcList =
        servicesRes?.data?.results || servicesRes?.data?.requests || servicesRes?.data?.data || [];
      const svcArr = (Array.isArray(svcList) ? svcList : []).filter(
        (it: any) => !isTransportService(it) && !isHousekeepingService(it)
      );
      const overdueServicesCount = svcArr.filter((o: any) => Boolean(getSlaStatus(o)?.isOverdue)).length;
      const unassignedSvc = svcArr.filter(
        (o: any) => !o.assigned_staff && o.status !== 'completed' && o.status !== 'cancelled'
      ).length;
      const overdueOrUnassignedServices = Math.max(overdueServicesCount, unassignedSvc);

      const maintList =
        maintRes?.data?.results || maintRes?.data?.tickets || maintRes?.data?.data || maintRes?.data || [];
      const maintArr = Array.isArray(maintList) ? maintList : [];
      const fixingList = maintArr.filter((t: any) => t.status === 'fixing');
      const unassignedMaintenanceCount = fixingList.filter(
        (t: any) => !t.technician && !t.technician_name
      ).length;

      const lfList = lfRes?.data?.results || lfRes?.data || [];
      const lfArr = Array.isArray(lfList) ? lfList : [];
      const storedLostFoundCount = lfArr.filter((it: any) => it.status === 'stored').length;

      setHotspots({
        checkoutInspectCount,
        overdueOrUnassignedServices,
        overdueServicesCount,
        fixingMaintenanceCount: fixingList.length,
        unassignedMaintenanceCount,
        storedLostFoundCount,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        'Không thể tải dữ liệu báo cáo điều hành.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchDashboardData(period);
    }
  }, [visible, period, fetchDashboardData]);

  const summary = report?.summary || {};
  const growthRate = Number(summary.growth_rate || 0);
  const isPositiveGrowth = growthRate >= 0;
  const totalRev = Number(summary.total_revenue || 0);
  const roomRev = Number(summary.room_revenue || 0);
  const svcRev = Number(summary.service_revenue || 0);
  const mixTotal = roomRev + svcRev || 1;
  const roomPct = Math.round((roomRev / mixTotal) * 100);
  const svcPct = totalRev > 0 ? Math.max(0, 100 - roomPct) : 0;

  const categories: any[] = Array.isArray(report?.revenue_by_category)
    ? report.revenue_by_category.slice(0, 4)
    : [];
  const topVips: any[] = Array.isArray(report?.top_vip_customers)
    ? report.top_vip_customers.slice(0, 4)
    : [];

  const hotspotRows = [
    {
      key: 'services',
      icon: 'restaurant' as const,
      title: 'Dịch vụ quá hạn SLA / chưa nhận',
      count: hotspots.overdueServicesCount > 0 ? hotspots.overdueServicesCount : hotspots.overdueOrUnassignedServices,
      sub:
        hotspots.overdueServicesCount > 0
          ? `${hotspots.overdueServicesCount} đơn đang trễ SLA cần thúc bếp/phục vụ`
          : hotspots.overdueOrUnassignedServices > 0
            ? `${hotspots.overdueOrUnassignedServices} đơn chưa có nhân viên tiếp nhận`
            : 'Mọi đơn dịch vụ đang trong tầm kiểm soát',
      severity: hotspots.overdueServicesCount > 0 ? 'danger' : hotspots.overdueOrUnassignedServices > 0 ? 'warn' : 'ok',
      route: '/(tabs)/services' as const,
    },
    {
      key: 'maintenance',
      icon: 'construct' as const,
      title: 'Phiếu bảo trì đang xử lý',
      count: hotspots.fixingMaintenanceCount,
      sub:
        hotspots.unassignedMaintenanceCount > 0
          ? `${hotspots.unassignedMaintenanceCount} phiếu chưa có kỹ thuật nhận sửa`
          : hotspots.fixingMaintenanceCount > 0
            ? `${hotspots.fixingMaintenanceCount} phiếu đang được kỹ thuật xử lý`
            : 'Không có sự cố thiết bị tồn đọng',
      severity: hotspots.unassignedMaintenanceCount > 0 ? 'danger' : hotspots.fixingMaintenanceCount > 0 ? 'warn' : 'ok',
      route: '/(tabs)/maintenance' as const,
    },
    {
      key: 'checkout',
      icon: 'bed' as const,
      title: 'Phòng chờ kiểm Check-out',
      count: hotspots.checkoutInspectCount,
      sub:
        hotspots.checkoutInspectCount > 0
          ? `${hotspots.checkoutInspectCount} phòng Lễ tân đang đợi kiểm Minibar`
          : 'Không có phòng chờ quyết toán gấp',
      severity: hotspots.checkoutInspectCount > 0 ? 'warn' : 'ok',
      route: '/(tabs)/housekeeping' as const,
    },
    {
      key: 'lost_found',
      icon: 'archive' as const,
      title: 'Đồ thất lạc chưa liên hệ khách',
      count: hotspots.storedLostFoundCount,
      sub:
        hotspots.storedLostFoundCount > 0
          ? `${hotspots.storedLostFoundCount} món đang lưu kho chờ gọi báo khách`
          : 'Tất cả đồ thất lạc đã được liên hệ / bàn giao',
      severity: hotspots.storedLostFoundCount > 0 ? 'warn' : 'ok',
      route: '/(tabs)/lost_found' as const,
    },
  ];

  const totalAlerts = hotspotRows.filter((r) => r.count > 0).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#0A0F1D' : '#F8FAFC',
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          {/* Drag indicator */}
          <View style={styles.dragHandleWrap}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.brandSub} numberOfLines={1}>
                {(hotelName || 'TA LUXURY').toUpperCase()} • EXECUTIVE VIEW
              </Text>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                Bảng Điều Hành & Doanh Thu
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                fetchDashboardData(period, true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={17} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={19} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Period Switcher */}
          <View style={styles.periodBar}>
            {[
              { key: 'day' as FilterPeriod, label: 'Hôm nay' },
              { key: 'week' as FilterPeriod, label: '7 ngày' },
              { key: 'month' as FilterPeriod, label: 'Tháng này' },
            ].map((p) => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.periodBtn,
                    {
                      backgroundColor: active ? '#F59E0B' : colors.card,
                      borderColor: active ? '#F59E0B' : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPeriod(p.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.periodBtnText,
                      { color: active ? '#0A0F1D' : colors.textMuted },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && !report ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Đang tổng hợp số liệu điều hành...
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchDashboardData(period, true)}
                  tintColor="#F59E0B"
                />
              }
            >
              {errorMsg ? (
                <View style={[styles.errorBanner, !isDark && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#FCA5A5' : '#B91C1C', fontWeight: '600' }}>
                    {errorMsg}
                  </Text>
                </View>
              ) : null}

              {/* 1. Hero Revenue Card */}
              <View
                style={[
                  styles.heroCard,
                  { backgroundColor: colors.card, borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A' },
                ]}
              >
                <View style={styles.heroTopRow}>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    DOANH THU THUẦN • {(report?.filter_label || 'TRONG KỲ').toUpperCase()}
                  </Text>
                  <View
                    style={[
                      styles.growthPill,
                      {
                        backgroundColor: isPositiveGrowth
                          ? 'rgba(16, 185, 129, 0.14)'
                          : 'rgba(239, 68, 68, 0.14)',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isPositiveGrowth ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={isPositiveGrowth ? '#10B981' : '#EF4444'}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: isPositiveGrowth ? '#10B981' : '#EF4444',
                      }}
                    >
                      {isPositiveGrowth ? '+' : ''}
                      {growthRate}%
                    </Text>
                  </View>
                </View>

                <Text style={[styles.heroRevenueVal, { color: colors.gold }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatVnd(totalRev)}
                </Text>
                {summary.prev_label ? (
                  <Text style={[styles.heroSubNote, { color: colors.textSubtle }]}>
                    Tăng trưởng {summary.prev_label}
                  </Text>
                ) : null}

                {/* Room vs Service mix bar */}
                <View style={styles.mixBarTrack}>
                  <View style={[styles.mixBarRoom, { width: `${totalRev > 0 ? roomPct : 50}%` }]} />
                  <View style={[styles.mixBarService, { width: `${totalRev > 0 ? svcPct : 50}%` }]} />
                </View>
                <View style={styles.mixLegendRow}>
                  <View style={styles.mixLegendItem}>
                    <View style={[styles.mixDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={[styles.mixLegendText, { color: colors.textMuted }]}>
                      Tiền phòng: <Text style={{ color: colors.text, fontWeight: '800' }}>{formatCompactVnd(roomRev)}</Text>
                    </Text>
                  </View>
                  <View style={styles.mixLegendItem}>
                    <View style={[styles.mixDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={[styles.mixLegendText, { color: colors.textMuted }]}>
                      Dịch vụ: <Text style={{ color: colors.text, fontWeight: '800' }}>{formatCompactVnd(svcRev)}</Text>
                    </Text>
                  </View>
                </View>
              </View>

              {/* 2. 4 Key Business KPIs (2 hàng cố định, không bao giờ rớt cột) */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiRow}>
                  <View style={[styles.kpiTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.kpiTileLabel, { color: colors.textMuted }]}>Công suất phòng</Text>
                    <Text style={[styles.kpiTileVal, { color: '#10B981' }]}>
                      {summary.occupancy_rate ?? 0}%
                    </Text>
                    <Text style={[styles.kpiTileSub, { color: colors.textSubtle }]} numberOfLines={1}>
                      {summary.occupied_rooms ?? 0}/{summary.total_rooms ?? 0} phòng có khách
                    </Text>
                  </View>

                  <View style={[styles.kpiTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.kpiTileLabel, { color: colors.textMuted }]}>Đơn đặt phòng</Text>
                    <Text style={[styles.kpiTileVal, { color: '#38BDF8' }]}>
                      {summary.total_bookings ?? 0}
                    </Text>
                    <Text style={[styles.kpiTileSub, { color: colors.textSubtle }]} numberOfLines={1}>
                      {summary.sold_room_nights ?? 0} đêm phòng bán ra
                    </Text>
                  </View>
                </View>

                <View style={styles.kpiRow}>
                  <View style={[styles.kpiTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.kpiTileLabel, { color: colors.textMuted }]}>Giá trị TB / đơn</Text>
                    <Text style={[styles.kpiTileVal, { color: '#F59E0B' }]} numberOfLines={1}>
                      {formatCompactVnd(summary.average_order_value)}
                    </Text>
                    <Text style={[styles.kpiTileSub, { color: colors.textSubtle }]} numberOfLines={1}>
                      AOV trong kỳ
                    </Text>
                  </View>

                  <View style={[styles.kpiTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.kpiTileLabel, { color: colors.textMuted }]}>Giá phòng TB (ADR)</Text>
                    <Text style={[styles.kpiTileVal, { color: '#A855F7' }]} numberOfLines={1}>
                      {formatCompactVnd(summary.adr)}
                    </Text>
                    <Text style={[styles.kpiTileSub, { color: colors.textSubtle }]} numberOfLines={1}>
                      RevPAR: {formatCompactVnd(summary.revpar)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 3. Live Ops Hotspots (Cảnh báo điểm nóng hiện trường) */}
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="pulse" size={16} color={totalAlerts > 0 ? '#EF4444' : '#10B981'} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Điểm Nóng Hiện Trường
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.alertCountPill,
                      {
                        backgroundColor:
                          totalAlerts > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.14)',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '800',
                        color: totalAlerts > 0 ? '#EF4444' : '#10B981',
                      }}
                    >
                      {totalAlerts > 0 ? `${totalAlerts} mục cần chú ý` : 'Vận hành ổn định'}
                    </Text>
                  </View>
                </View>

                {hotspotRows.map((row, idx) => {
                  const accent =
                    row.severity === 'danger'
                      ? '#EF4444'
                      : row.severity === 'warn'
                        ? '#F59E0B'
                        : '#10B981';
                  return (
                    <React.Fragment key={row.key}>
                      {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                      <TouchableOpacity
                        style={styles.hotspotRow}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onClose();
                          onNavigateTab(row.route);
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.hotspotIconBox,
                            { backgroundColor: `${accent}1F` },
                          ]}
                        >
                          <Ionicons name={row.icon} size={16} color={accent} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.hotspotTitle, { color: colors.text }]} numberOfLines={1}>
                            {row.title}
                          </Text>
                          <Text style={[styles.hotspotSub, { color: colors.textMuted }]} numberOfLines={1}>
                            {row.sub}
                          </Text>
                        </View>
                        <View style={[styles.hotspotBadge, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: accent }}>
                            {row.count}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>

              {/* 4. Top Room Categories */}
              {categories.length > 0 && (
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="layers" size={15} color="#F59E0B" />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Doanh Thu Theo Hạng Phòng
                      </Text>
                    </View>
                  </View>

                  {categories.map((cat) => (
                    <View key={String(cat.category_id || cat.name)} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>
                          {cat.category_name || cat.name}
                        </Text>
                        <Text style={[styles.catVal, { color: colors.textMuted }]}>
                          {formatCompactVnd(cat.revenue)} ({cat.percentage}%)
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(100, Math.max(4, Number(cat.percentage || 0)))}%`,
                              backgroundColor: cat.color || '#F59E0B',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* 5. Top VIP Customers */}
              {topVips.length > 0 && (
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="diamond" size={15} color="#38BDF8" />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Top Khách Hàng VIP Trong Kỳ
                      </Text>
                    </View>
                  </View>

                  {topVips.map((vip, idx) => (
                    <React.Fragment key={String(vip.id || idx)}>
                      {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                      <TouchableOpacity
                        style={styles.vipRow}
                        onPress={() => {
                          if (vip.id && onSelectVipGuest) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onClose();
                            onSelectVipGuest(vip.id);
                          }
                        }}
                        disabled={!onSelectVipGuest}
                        activeOpacity={0.7}
                      >
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankText}>#{vip.rank || idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.vipName, { color: colors.text }]} numberOfLines={1}>
                            {vip.full_name || vip.username}
                          </Text>
                          <Text style={[styles.vipSub, { color: colors.textMuted }]} numberOfLines={1}>
                            {vip.vip_tier || 'VIP'} • {vip.booking_count || 0} lượt đặt
                          </Text>
                        </View>
                        <Text style={[styles.vipSpent, { color: '#10B981' }]}>
                          {formatCompactVnd(vip.total_spent)}
                        </Text>
                        {onSelectVipGuest && (
                          <Ionicons name="chevron-forward" size={15} color={colors.textSubtle} style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 2,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
    marginRight: 8,
  },
  growthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroRevenueVal: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroSubNote: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  mixBarTrack: {
    flexDirection: 'row',
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: 12,
    marginBottom: 8,
  },
  mixBarRoom: {
    backgroundColor: '#3B82F6',
    height: '100%',
  },
  mixBarService: {
    backgroundColor: '#F59E0B',
    height: '100%',
  },
  mixLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  mixLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mixDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  mixLegendText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  kpiGrid: {
    gap: 10,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiTile: {
    flex: 1,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
  },
  kpiTileLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiTileVal: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  kpiTileSub: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 3,
  },
  sectionCard: {
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  alertCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  divider: {
    height: 1,
    marginVertical: 9,
  },
  hotspotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hotspotIconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotspotTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  hotspotSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  hotspotBadge: {
    minWidth: 30,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  catName: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  catVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  vipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F59E0B',
  },
  vipName: {
    fontSize: 13,
    fontWeight: '700',
  },
  vipSub: {
    fontSize: 11,
    marginTop: 2,
  },
  vipSpent: {
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8,
  },
});

