import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme, resolveMobileMediaUrl } from '../../contexts/ThemeContext';
import { safeOpenUrl } from '../../utils/linking';

export interface StaffDirectoryModalProps {
  visible: boolean;
  onClose: () => void;
}

const ROLE_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'housekeeper', label: 'Buồng phòng' },
  { key: 'service_staff', label: 'Phục vụ' },
  { key: 'technician', label: 'Kỹ thuật' },
  { key: 'receptionist', label: 'Lễ tân' },
  { key: 'cashier', label: 'Thu ngân' },
  { key: 'manager', label: 'Quản lý' },
];

const EXTRA_SHIFT_FILTERS = [
  { key: 'all', label: 'Tất cả ca' },
  { key: 'hành chính', label: 'Hành chính' },
  { key: 'gãy', label: 'Ca Gãy' },
  { key: 'xoay', label: 'Ca Xoay' },
];

const getRoleMeta = (role?: string) => {
  switch (role) {
    case 'owner':
      return { label: 'Chủ KS', color: '#F59E0B' };
    case 'admin':
      return { label: 'Admin', color: '#A855F7' };
    case 'manager':
      return { label: 'Quản lý', color: '#3B82F6' };
    case 'receptionist':
      return { label: 'Lễ tân', color: '#10B981' };
    case 'cashier':
      return { label: 'Thu ngân', color: '#06B6D4' };
    case 'housekeeper':
      return { label: 'Buồng phòng', color: '#F97316' };
    case 'service_staff':
      return { label: 'Phục vụ', color: '#EC4899' };
    case 'technician':
      return { label: 'Kỹ thuật', color: '#6366F1' };
    default:
      return { label: role || 'Nhân sự', color: '#64748B' };
  }
};

// Phân loại ca làm việc khớp với chuẩn 0007_normalize_employee_shifts_and_positions
const parseShiftInfo = (rawShift?: string) => {
  const clean = (rawShift || '').trim();
  if (!clean) {
    return {
      bucket: 'other' as const,
      title: 'Chưa xếp ca',
      hours: '',
      color: '#64748B',
      icon: 'time-outline' as const,
    };
  }

  const low = clean.toLowerCase();
  const parenMatch = clean.match(/^(.+?)\s*\((.+)\)$/);
  const title = parenMatch ? parenMatch[1].trim() : clean;
  const hours = parenMatch ? parenMatch[2].trim() : '';

  if (low.includes('gãy')) {
    return { bucket: 'other' as const, title, hours, color: '#EC4899', icon: 'git-compare-outline' as const };
  }
  if (low.includes('xoay')) {
    return { bucket: 'other' as const, title, hours, color: '#8B5CF6', icon: 'repeat-outline' as const };
  }
  if (low.includes('hành chính')) {
    return { bucket: 'other' as const, title, hours, color: '#10B981', icon: 'briefcase-outline' as const };
  }
  if (low.includes('đêm')) {
    return { bucket: 'night' as const, title, hours, color: '#6366F1', icon: 'moon-outline' as const };
  }
  if (low.includes('chiều')) {
    return { bucket: 'afternoon' as const, title, hours, color: '#F97316', icon: 'partly-sunny-outline' as const };
  }
  if (low.includes('sáng')) {
    return { bucket: 'morning' as const, title, hours, color: '#F59E0B', icon: 'sunny-outline' as const };
  }

  return { bucket: 'other' as const, title, hours, color: '#38BDF8', icon: 'time-outline' as const };
};

export default function StaffDirectoryModal({ visible, onClose }: StaffDirectoryModalProps) {
  const { apiUrl } = useAuth();
  const { colors, isDark, hotelName } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftTab, setShiftTab] = useState<'all' | 'morning' | 'afternoon' | 'night' | 'other'>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [extraShiftFilter, setExtraShiftFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchEmployees = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await apiClient.get('/auth/admin/employees/?no_page=true');
      const list = res.data?.employees || res.data?.results || res.data?.data || res.data || [];
      setEmployees(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Lỗi tải danh bạ nhân sự:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchEmployees(false);
    }
  }, [visible, fetchEmployees]);

  // Đếm quân số theo ca trực
  const shiftStats = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let night = 0;
    let other = 0;
    employees.forEach((emp) => {
      const info = parseShiftInfo(emp.employee_profile?.shift || emp.shift);
      if (info.bucket === 'morning') morning += 1;
      else if (info.bucket === 'afternoon') afternoon += 1;
      else if (info.bucket === 'night') night += 1;
      else other += 1;
    });
    return { total: employees.length, morning, afternoon, night, other };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      const rawShift = String(emp.employee_profile?.shift || emp.shift || '');
      const shiftInfo = parseShiftInfo(rawShift);

      if (shiftTab !== 'all' && shiftInfo.bucket !== shiftTab) {
        return false;
      }

      if (extraShiftFilter !== 'all' && !rawShift.toLowerCase().includes(extraShiftFilter)) {
        return false;
      }

      if (roleFilter !== 'all') {
        if (roleFilter === 'manager') {
          if (!['manager', 'owner', 'admin'].includes(emp.role)) return false;
        } else if (emp.role !== roleFilter) {
          return false;
        }
      }

      if (q) {
        const fullName = String(
          emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}` || emp.username || ''
        ).toLowerCase();
        const phone = String(emp.phone_number || '').toLowerCase();
        const code = String(emp.employee_profile?.employee_code || emp.employee_code || '').toLowerCase();
        const dept = String(emp.employee_profile?.department || emp.department || '').toLowerCase();
        const pos = String(emp.employee_profile?.position || emp.position || '').toLowerCase();
        if (
          !fullName.includes(q) &&
          !phone.includes(q) &&
          !code.includes(q) &&
          !dept.includes(q) &&
          !pos.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [employees, shiftTab, extraShiftFilter, roleFilter, searchQuery]);

  const activeAdvancedFilterCount =
    (roleFilter !== 'all' ? 1 : 0) + (extraShiftFilter !== 'all' ? 1 : 0);

  const resetAllFilters = () => {
    Haptics.selectionAsync();
    setShiftTab('all');
    setRoleFilter('all');
    setExtraShiftFilter('all');
    setSearchQuery('');
  };

  const callStaff = (phone?: string, name?: string) => {
    if (!phone) {
      Alert.alert('Chưa có SĐT', `${name || 'Nhân viên này'} chưa cập nhật số điện thoại.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    safeOpenUrl(`tel:${phone}`, 'Thiết bị không hỗ trợ thực hiện cuộc gọi.');
  };

  const smsStaff = (phone?: string, name?: string) => {
    if (!phone) {
      Alert.alert('Chưa có SĐT', `${name || 'Nhân viên này'} chưa cập nhật số điện thoại.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const body = encodeURIComponent(`[${hotelName || 'TA Luxury'}] Chào ${name || 'bạn'}, `);
    safeOpenUrl(`sms:${phone}?body=${body}`, 'Thiết bị không hỗ trợ nhắn tin SMS.');
  };

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

          {/* 1. Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.brandSub}>
                ĐIỀU PHỐI NHÂN SỰ • {filteredEmployees.length}/{employees.length} NGƯỜI
              </Text>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                Danh Bạ & Ca Trực
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                fetchEmployees(true);
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

          {/* 2. Dải KPI Quân Số Theo Ca (5 cột cân đối, chạm để lọc nhanh) */}
          <View style={styles.kpiBar}>
            {[
              { key: 'all' as const, label: 'Tất cả', count: shiftStats.total, color: isDark ? '#F8FAFC' : '#0F172A' },
              { key: 'morning' as const, label: 'Sáng', count: shiftStats.morning, color: '#F59E0B' },
              { key: 'afternoon' as const, label: 'Chiều', count: shiftStats.afternoon, color: '#F97316' },
              { key: 'night' as const, label: 'Đêm', count: shiftStats.night, color: '#6366F1' },
              { key: 'other' as const, label: 'HC/Khác', count: shiftStats.other, color: isDark ? '#34D399' : '#059669' },
            ].map((item) => {
              const selected = shiftTab === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.kpiCard,
                    {
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(245, 158, 11, 0.14)'
                          : 'rgba(245, 158, 11, 0.12)'
                        : colors.card,
                      borderColor: selected ? '#F59E0B' : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShiftTab(item.key);
                    if (item.key !== 'all' && item.key !== 'other') {
                      setExtraShiftFilter('all');
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.kpiNumber, { color: selected ? '#F59E0B' : item.color }]}>
                    {item.count}
                  </Text>
                  <Text
                    style={[
                      styles.kpiLabel,
                      { color: selected ? (isDark ? '#FBBF24' : '#B45309') : colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. Ô Tìm Kiếm + Nút [Lọc ▾] Gọn Trên 1 Dòng */}
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textSubtle} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Tìm tên, mã NV, SĐT, chức danh..."
                placeholderTextColor={colors.textSubtle}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textSubtle} />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={[
                styles.filterToggleBtn,
                {
                  backgroundColor:
                    showFilters || activeAdvancedFilterCount > 0
                      ? 'rgba(245, 158, 11, 0.16)'
                      : colors.card,
                  borderColor:
                    showFilters || activeAdvancedFilterCount > 0 ? '#F59E0B' : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowFilters((prev) => !prev);
              }}
              activeOpacity={0.75}
            >
              <Ionicons
                name={showFilters ? 'funnel' : 'funnel-outline'}
                size={14}
                color={showFilters || activeAdvancedFilterCount > 0 ? '#F59E0B' : colors.textMuted}
                style={{ marginRight: 4 }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color:
                    showFilters || activeAdvancedFilterCount > 0
                      ? isDark
                        ? '#FBBF24'
                        : '#B45309'
                      : colors.textMuted,
                }}
              >
                Lọc{activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
              </Text>
              <Ionicons
                name={showFilters ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={showFilters || activeAdvancedFilterCount > 0 ? '#F59E0B' : colors.textSubtle}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          </View>

          {/* 3b. Thanh tóm tắt bộ lọc khi đang thu gọn */}
          {!showFilters && activeAdvancedFilterCount > 0 && (
            <View
              style={[
                styles.activeSummaryBar,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                },
              ]}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: isDark ? '#FBBF24' : '#B45309',
                }}
                numberOfLines={1}
              >
                Đang lọc:{' '}
                {[
                  roleFilter !== 'all' ? ROLE_FILTERS.find((r) => r.key === roleFilter)?.label : null,
                  extraShiftFilter !== 'all'
                    ? EXTRA_SHIFT_FILTERS.find((s) => s.key === extraShiftFilter)?.label
                    : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
              <TouchableOpacity onPress={resetAllFilters} activeOpacity={0.7}>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#EF4444' }}>Xóa lọc</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 3c. Panel Lọc Mở Rộng (Bộ phận & Ca đặc biệt) */}
          {showFilters && (
            <View
              style={[
                styles.filterPanel,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.filterSectionLabel, { color: colors.textMuted }]}>Bộ phận / Vai trò</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
              >
                {ROLE_FILTERS.map((r) => {
                  const active = roleFilter === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? '#F59E0B' : isDark ? '#0F172A' : '#F8FAFC',
                          borderColor: active ? '#F59E0B' : colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRoleFilter(r.key);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, { color: active ? '#0A0F1D' : colors.textMuted }]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.filterSectionLabel, { color: colors.textMuted }]}>
                Ca Hành chính / Ca linh hoạt
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {EXTRA_SHIFT_FILTERS.map((s) => {
                  const active = extraShiftFilter === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? 'rgba(56, 189, 248, 0.18)'
                            : isDark
                              ? '#0F172A'
                              : '#F8FAFC',
                          borderColor: active ? '#38BDF8' : colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setExtraShiftFilter(s.key);
                        if (s.key !== 'all') setShiftTab('all');
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? (isDark ? '#7DD3FC' : '#0284C7') : colors.textMuted },
                        ]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 4. Danh Sách Thẻ Nhân Viên (Bố cục 3 tầng thoáng, không cắt chữ) */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Đang tải danh sách nhân sự...
              </Text>
            </View>
          ) : filteredEmployees.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="people-outline" size={48} color={isDark ? '#334155' : '#CBD5E1'} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Không tìm thấy nhân sự phù hợp
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Thử chọn ca khác hoặc xóa bộ lọc đang áp dụng.
              </Text>
              {(shiftTab !== 'all' || activeAdvancedFilterCount > 0 || searchQuery.trim()) && (
                <TouchableOpacity style={styles.resetEmptyBtn} onPress={resetAllFilters} activeOpacity={0.8}>
                  <Text style={styles.resetEmptyBtnText}>Hiển thị tất cả nhân sự</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredEmployees}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24, paddingTop: 2 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchEmployees(true)}
                  tintColor="#F59E0B"
                />
              }
              renderItem={({ item }) => {
                const fullName =
                  item.full_name ||
                  [item.first_name, item.last_name].filter(Boolean).join(' ') ||
                  item.username;
                const roleMeta = getRoleMeta(item.role);
                const profile = item.employee_profile || {};
                const empCode = profile.employee_code || `NV-${item.id}`;
                const department = profile.department || 'Vận hành';
                const position = profile.position || '';
                const shiftInfo = parseShiftInfo(profile.shift || item.shift);
                const avatarUri = resolveMobileMediaUrl(item.avatar, apiUrl);
                const isActive = item.is_active !== false;

                return (
                  <View
                    style={[
                      styles.empCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      !isActive && { opacity: 0.62 },
                    ]}
                  >
                    {/* Tầng 1: Avatar + Tên đầy đủ + Vai trò + Chức danh/Mã NV */}
                    <View style={styles.cardHeaderRow}>
                      <View style={[styles.avatarBox, { borderColor: `${roleMeta.color}77` }]}>
                        {avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                        ) : (
                          <Text style={[styles.avatarInitial, { color: roleMeta.color }]}>
                            {(fullName || 'N').trim().charAt(0).toUpperCase()}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isActive ? '#10B981' : '#94A3B8',
                              borderColor: colors.card,
                            },
                          ]}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 11 }}>
                        <View style={styles.nameRoleRow}>
                          <Text style={[styles.empName, { color: colors.text }]} numberOfLines={1}>
                            {fullName}
                          </Text>
                          <View
                            style={[
                              styles.rolePill,
                              { backgroundColor: `${roleMeta.color}1C`, borderColor: `${roleMeta.color}44` },
                            ]}
                          >
                            <Text style={[styles.rolePillText, { color: roleMeta.color }]}>
                              {roleMeta.label}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.empPosition, { color: colors.textMuted }]} numberOfLines={1}>
                          {empCode} • {position || department}
                        </Text>
                      </View>
                    </View>

                    {/* Tầng 2: Thanh Ca Trực đầy đủ giờ giấc (không bị ép hay cắt chữ) */}
                    <View
                      style={[
                        styles.shiftStrip,
                        {
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : '#F8FAFC',
                          borderColor: `${shiftInfo.color}38`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={shiftInfo.icon}
                        size={14}
                        color={shiftInfo.color}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.shiftTitleText, { color: shiftInfo.color }]} numberOfLines={1}>
                        {shiftInfo.title}
                      </Text>
                      {shiftInfo.hours ? (
                        <Text style={[styles.shiftHoursText, { color: colors.textMuted }]} numberOfLines={1}>
                          • {shiftInfo.hours}
                        </Text>
                      ) : null}
                    </View>

                    {/* Tầng 3: SĐT + Nút Nhắn tin / Gọi điều phối rõ ràng */}
                    <View style={[styles.cardFooterRow, { borderTopColor: colors.border }]}>
                      <View style={styles.phoneInfoWrap}>
                        <Ionicons
                          name={item.phone_number ? 'call-outline' : 'alert-circle-outline'}
                          size={13}
                          color={item.phone_number ? colors.textSubtle : '#94A3B8'}
                          style={{ marginRight: 5 }}
                        />
                        <Text
                          style={[
                            styles.phoneNumberText,
                            { color: item.phone_number ? colors.text : colors.textSubtle },
                          ]}
                          numberOfLines={1}
                        >
                          {item.phone_number || 'Chưa có SĐT'}
                        </Text>
                      </View>

                      <View style={styles.footerActions}>
                        <TouchableOpacity
                          style={[
                            styles.smsActionPill,
                            !isDark && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                            !item.phone_number && { opacity: 0.35 },
                          ]}
                          onPress={() => smsStaff(item.phone_number, fullName)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={13} color="#D97706" style={{ marginRight: 4 }} />
                          <Text style={[styles.smsActionText, !isDark && { color: '#B45309' }]}>Nhắn tin</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.callActionPill,
                            !item.phone_number && { opacity: 0.35 },
                          ]}
                          onPress={() => callStaff(item.phone_number, fullName)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="call" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.callActionText}>Gọi ngay</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 11,
    borderBottomWidth: 1,
    gap: 8,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
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
  kpiBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1.2,
  },
  kpiNumber: {
    fontSize: 15,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  filterPanel: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
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
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  resetEmptyBtn: {
    marginTop: 14,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  resetEmptyBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  empCard: {
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImg: {
    width: 41,
    height: 41,
    borderRadius: 21,
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '900',
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 2,
  },
  nameRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  empName: {
    fontSize: 14.5,
    fontWeight: '800',
    flex: 1,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  empPosition: {
    fontSize: 11.5,
    marginTop: 3,
    fontWeight: '600',
  },
  shiftStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  shiftTitleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  shiftHoursText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginLeft: 5,
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  phoneInfoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phoneNumberText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  smsActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  smsActionText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FBBF24',
  },
  callActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  callActionText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
