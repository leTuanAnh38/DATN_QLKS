import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme, resolveMobileMediaUrl } from '../contexts/ThemeContext';

export interface AssignableStaff {
  id: number;
  username: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  avatar?: string | null;
  department?: string | null;
  position?: string | null;
  shift?: string | null;
  employee_code?: string | null;
  employee_profile?: {
    department?: string | null;
    position?: string | null;
    shift?: string | null;
    employee_code?: string | null;
  } | null;
}

export interface AssignStaffModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  recommendedRoles?: string[];
  recommendedLabel?: string;
  currentAssigneeId?: number | null;
  currentAssigneeName?: string | null;
  submitting?: boolean;
  onClose: () => void;
  onAssign: (staff: AssignableStaff) => Promise<void> | void;
}

const getRoleBadgeMeta = (role?: string) => {
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
      return { label: 'Phục vụ / Đội xe', color: '#EC4899' };
    case 'technician':
      return { label: 'Kỹ thuật', color: '#6366F1' };
    default:
      return { label: role || 'Nhân viên', color: '#64748B' };
  }
};

export const getStaffDisplayName = (staff: AssignableStaff): string => {
  const full =
    staff.full_name?.trim() ||
    `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
  return full || staff.username;
};

// Chỉ cho phép phân công nhóm nhân sự thực thi hiện trường (loại bỏ Chủ KS, Admin, Quản lý, Thu ngân, Lễ tân)
const ASSIGNABLE_FIELD_ROLES = ['service_staff', 'housekeeper', 'technician'];

export default function AssignStaffModal({
  visible,
  title = 'Phân Công Nhân Viên',
  subtitle,
  recommendedRoles = [],
  recommendedLabel = 'Đúng bộ phận',
  currentAssigneeId,
  currentAssigneeName,
  submitting = false,
  onClose,
  onAssign,
}: AssignStaffModalProps) {
  const { apiUrl, user } = useAuth();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [employees, setEmployees] = useState<AssignableStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyRecommended, setOnlyRecommended] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const recommendedKey = recommendedRoles.join(',');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/auth/admin/employees/?is_active=true&no_page=true');
      const list = res.data?.employees || res.data?.results || res.data?.data || res.data || [];
      const activeFieldStaff = (Array.isArray(list) ? list : []).filter(
        (emp: any) =>
          emp &&
          emp.id &&
          emp.is_active !== false &&
          emp.id !== user?.id &&
          ASSIGNABLE_FIELD_ROLES.includes(emp.role)
      );
      setEmployees(activeFieldStaff);
    } catch (err) {
      console.warn('Lỗi tải danh sách nhân viên phân công:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setAssigningId(null);
      setOnlyRecommended(recommendedRoles.length > 0);
      fetchEmployees();
    }
  }, [visible, recommendedKey, fetchEmployees]);

  const recommendedCount = useMemo(() => {
    if (recommendedRoles.length === 0) return 0;
    return employees.filter((e) => recommendedRoles.includes(e.role)).length;
  }, [employees, recommendedKey]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const useRecommendedFilter = onlyRecommended && recommendedRoles.length > 0 && recommendedCount > 0;

    return employees
      .filter((emp) => {
        if (useRecommendedFilter && !recommendedRoles.includes(emp.role)) {
          return false;
        }
        if (!q) return true;
        const name = getStaffDisplayName(emp).toLowerCase();
        const username = (emp.username || '').toLowerCase();
        const code = (emp.employee_profile?.employee_code || emp.employee_code || '').toLowerCase();
        const dept = (emp.employee_profile?.department || emp.department || '').toLowerCase();
        const shift = (emp.employee_profile?.shift || emp.shift || '').toLowerCase();
        const roleLabel = getRoleBadgeMeta(emp.role).label.toLowerCase();
        return (
          name.includes(q) ||
          username.includes(q) ||
          code.includes(q) ||
          dept.includes(q) ||
          shift.includes(q) ||
          roleLabel.includes(q)
        );
      })
      .sort((a, b) => {
        const aRec = recommendedRoles.includes(a.role) ? 0 : 1;
        const bRec = recommendedRoles.includes(b.role) ? 0 : 1;
        if (aRec !== bRec) return aRec - bRec;
        if (a.id === currentAssigneeId) return -1;
        if (b.id === currentAssigneeId) return 1;
        return getStaffDisplayName(a).localeCompare(getStaffDisplayName(b), 'vi');
      });
  }, [employees, searchQuery, onlyRecommended, recommendedKey, recommendedCount, currentAssigneeId]);

  const handleSelectStaff = async (staff: AssignableStaff) => {
    if (submitting || assigningId !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAssigningId(staff.id);
    try {
      await onAssign(staff);
    } finally {
      setAssigningId(null);
    }
  };

  const renderStaffItem = ({ item }: { item: AssignableStaff }) => {
    const displayName = getStaffDisplayName(item);
    const roleMeta = getRoleBadgeMeta(item.role);
    const dept = item.employee_profile?.department || item.department || '';
    const shift = item.employee_profile?.shift || item.shift || '';
    const empCode = item.employee_profile?.employee_code || item.employee_code || '';
    const avatarUri = resolveMobileMediaUrl(item.avatar, apiUrl);
    const isCurrent = Boolean(currentAssigneeId && item.id === currentAssigneeId);
    const isBusy = assigningId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.staffCard,
          !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
          isCurrent && {
            borderColor: '#F59E0B',
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
          },
        ]}
        onPress={() => handleSelectStaff(item)}
        disabled={submitting || assigningId !== null}
        activeOpacity={0.75}
      >
        <View style={[styles.avatarBox, { borderColor: `${roleMeta.color}66` }]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarInitial, { color: roleMeta.color }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 11, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text
              style={[styles.staffName, !isDark && { color: '#0F172A' }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: `${roleMeta.color}20`, borderColor: `${roleMeta.color}55` },
              ]}
            >
              <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
            </View>
          </View>

          <Text style={[styles.staffMeta, !isDark && { color: '#64748B' }]} numberOfLines={1}>
            {[empCode, dept, shift].filter(Boolean).join(' • ') || `@${item.username}`}
          </Text>
        </View>

        {isBusy ? (
          <ActivityIndicator size="small" color="#F59E0B" />
        ) : isCurrent ? (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#F59E0B" style={{ marginRight: 3 }} />
            <Text style={styles.currentBadgeText}>Đang nhận</Text>
          </View>
        ) : (
          <View
            style={[
              styles.assignPill,
              !isDark && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
            ]}
          >
            <Ionicons name="person-add-outline" size={13} color={isDark ? '#FBBF24' : '#B45309'} style={{ marginRight: 4 }} />
            <Text style={[styles.assignPillText, !isDark && { color: '#B45309' }]}>Giao việc</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 14) },
            !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0' },
          ]}
        >
          {/* Drag indicator */}
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: isDark ? '#334155' : '#CBD5E1',
              }}
            />
          </View>

          {/* Header */}
          <View style={[styles.headerRow, !isDark && { borderBottomColor: '#F1F5F9' }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.title, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, !isDark && { color: '#64748B' }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
              {currentAssigneeName ? (
                <Text style={styles.currentHint} numberOfLines={1}>
                  Hiện phụ trách: {currentAssigneeName}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          </View>

          {/* Bộ lọc bộ phận gợi ý */}
          {recommendedRoles.length > 0 && recommendedCount > 0 && employees.length > recommendedCount && (
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !isDark && !onlyRecommended && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                  onlyRecommended && styles.filterChipActive,
                ]}
                onPress={() => {
                  setOnlyRecommended(true);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    !isDark && !onlyRecommended && { color: '#475569' },
                    onlyRecommended && styles.filterChipTextActive,
                  ]}
                >
                  {recommendedLabel} ({recommendedCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !isDark && onlyRecommended && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                  !onlyRecommended && styles.filterChipActive,
                ]}
                onPress={() => {
                  setOnlyRecommended(false);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    !isDark && onlyRecommended && { color: '#475569' },
                    !onlyRecommended && styles.filterChipTextActive,
                  ]}
                >
                  Hỗ trợ hiện trường ({employees.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ô tìm kiếm */}
          <View
            style={[
              styles.searchBox,
              !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
            ]}
          >
            <Ionicons name="search-outline" size={16} color={isDark ? '#64748B' : '#94A3B8'} />
            <TextInput
              style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
              placeholder="Tìm tên nhân viên, mã NV, ca trực..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Danh sách nhân viên */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>
                Đang tải danh sách nhân sự...
              </Text>
            </View>
          ) : filteredStaff.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="people-outline" size={44} color={isDark ? '#475569' : '#CBD5E1'} />
              <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>
                Không tìm thấy nhân viên phù hợp
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredStaff}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderStaffItem}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '52%',
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  currentHint: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#F8FAFC',
  },
  centerBox: {
    paddingVertical: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 13,
    color: '#94A3B8',
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '900',
  },
  staffName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  staffMeta: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 3,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  assignPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  assignPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FBBF24',
  },
});

