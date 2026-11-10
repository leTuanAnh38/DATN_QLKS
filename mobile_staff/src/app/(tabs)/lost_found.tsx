import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import { LostFoundListSkeleton } from '../../components/SkeletonLoader';
import {
  LostFoundCard,
  LostFoundItem,
  CreateLostFoundModal,
  ReturnLostFoundModal,
  ImagePreviewModal,
  LOST_FOUND_CATEGORIES,
} from '../../components/lost_found';

export default function LostFoundScreen() {
  const { user } = useAuth();
  const { colors, isDark, hotelStars, hotelName } = useAppTheme();
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategories, setShowCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Modals state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);

  const fetchLostItems = useCallback(async () => {
    try {
      const res = await apiClient.get('/rooms/lost-and-found/');
      const list = res.data.results || res.data || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Lỗi tải danh mục đồ thất lạc:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLostItems();
  }, [fetchLostItems]);

  // Real-time polling 6 giây đồng bộ tài sản thất lạc (chỉ khi tab hiển thị & app ở foreground)
  useFocusPolling(fetchLostItems, 6000);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleCount(15);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchLostItems();
  };

  // KPI stats
  const stats = useMemo(() => {
    const total = items.length;
    const stored = items.filter((it) => it.status === 'stored').length;
    const contacted = items.filter((it) => it.status === 'contacted').length;
    const returned = items.filter((it) => it.status === 'returned').length;
    const returnRate = total > 0 ? Math.round((returned / total) * 1000) / 10 : 0;
    return { total, stored, contacted, returned, returnRate };
  }, [items]);

  // Bộ lọc
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      let matchStatus = true;
      if (filterStatus === 'stored') {
        matchStatus = it.status === 'stored';
      } else if (filterStatus === 'contacted') {
        matchStatus = it.status === 'contacted';
      } else if (filterStatus === 'returned') {
        matchStatus = it.status === 'returned';
      }

      let matchCategory = true;
      if (selectedCategory !== 'all') {
        matchCategory = it.category === selectedCategory;
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (it.item_name && it.item_name.toLowerCase().includes(q)) ||
        (it.location_found && it.location_found.toLowerCase().includes(q)) ||
        (it.tracking_code && it.tracking_code.toLowerCase().includes(q)) ||
        (it.guest_name && it.guest_name.toLowerCase().includes(q));

      return matchStatus && matchCategory && matchSearch;
    });
  }, [items, filterStatus, selectedCategory, searchQuery]);

  // Infinite Scroll
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(15);
  }, [filterStatus, selectedCategory, searchQuery]);

  const displayedItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  const handleLoadMore = () => {
    if (loadingMore || visibleCount >= filteredItems.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 15, filteredItems.length));
      setLoadingMore(false);
    }, 250);
  };

  const renderFooter = () => {
    if (filteredItems.length <= 15) return <View style={{ height: 20 }} />;
    if (loadingMore) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm tài sản cũ hơn...</Text>
        </View>
      );
    }
    if (visibleCount >= filteredItems.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredItems.length} tài sản</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCount}/{filteredItems.length} món • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

  const handleMarkContacted = async (item: LostFoundItem) => {
    if (actionLoadingId) return;
    setActionLoadingId(item.id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await apiClient.patch(`/rooms/lost-and-found/${item.id}/`, {
        status: 'contacted',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Đã cập nhật', `Đã đánh dấu đã liên hệ báo khách cho đồ #${item.tracking_code}!`);
      fetchLostItems();
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: LostFoundItem }) => (
      <LostFoundCard
        item={item}
        isLoading={actionLoadingId === item.id}
        onPreviewImage={setPreviewImageUrl}
        onCallPhone={(phone) => Linking.openURL(`tel:${phone}`)}
        onMarkContacted={handleMarkContacted}
        onOpenReturn={(it) => {
          setSelectedItem(it);
          setReturnModalVisible(true);
        }}
      />
    ),
    [actionLoadingId, handleMarkContacted]
  );

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header Khách Sạn */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>{hotelName.toUpperCase()} • {hotelStars} SAO</Text>
          <Text style={[styles.greetingTitle, { color: colors.text }]}>Đồ Thất Lạc</Text>
        </View>
        <View style={styles.headerRightActions}>
          <NotificationBell />
          <TouchableOpacity
            style={styles.createCircleBtn}
            onPress={() => setCreateModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#0A0F1D" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.refreshCircleBtn,
              !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            ]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 4 Cột Cân Đối */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'all', label: 'Tất cả', count: stats.total, color: isDark ? '#F8FAFC' : '#0F172A' },
          { key: 'stored', label: 'Lưu kho', count: stats.stored, color: '#F59E0B' },
          { key: 'contacted', label: 'Đã liên hệ', count: stats.contacted, color: isDark ? '#38BDF8' : '#0284C7' },
          { key: 'returned', label: 'Đã trả', count: stats.returned, color: isDark ? '#34D399' : '#059669' },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                !isDark && {
                  backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#FFFFFF',
                  borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                  shadowColor: '#64748B',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 1,
                },
                isSelected && isDark && styles.fixedFilterCardSelected,
              ]}
              onPress={() => {
                setFilterStatus(item.key);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.fixedFilterNumber, { color: isSelected ? '#F59E0B' : item.color }]}>
                {item.count}
              </Text>
              <Text
                style={[
                  styles.fixedFilterLabel,
                  !isDark && { color: isSelected ? '#D97706' : '#64748B' },
                  isSelected && isDark && styles.fixedFilterLabelSelected,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Ô Tìm Kiếm Kết Hợp Nút [Danh mục ▾] */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, gap: 8 }}>
        <View
          style={[
            styles.searchWrapper,
            { flex: 1, marginHorizontal: 0, marginBottom: 0 },
            !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
          ]}
        >
          <Ionicons name="search-outline" size={17} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 10 }} />
          <TextInput
            style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
            placeholder="Tìm tên đồ vật, số phòng, mã phiếu..."
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={17} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 40,
            paddingHorizontal: 11,
            borderRadius: 12,
            borderWidth: 1,
            backgroundColor: showCategories || selectedCategory !== 'all'
              ? 'rgba(245, 158, 11, 0.16)'
              : (isDark ? '#1E293B' : '#FFFFFF'),
            borderColor: showCategories || selectedCategory !== 'all'
              ? '#F59E0B'
              : (isDark ? '#334155' : '#E2E8F0'),
          }}
          onPress={() => {
            setShowCategories((prev) => !prev);
            Haptics.selectionAsync();
          }}
          activeOpacity={0.75}
        >
          <Ionicons
            name={showCategories ? 'funnel' : 'funnel-outline'}
            size={14}
            color={showCategories || selectedCategory !== 'all' ? '#F59E0B' : (isDark ? '#CBD5E1' : '#475569')}
            style={{ marginRight: 4 }}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: showCategories || selectedCategory !== 'all'
                ? (isDark ? '#FBBF24' : '#B45309')
                : (isDark ? '#CBD5E1' : '#475569'),
            }}
          >
            {selectedCategory === 'all'
              ? 'Loại đồ'
              : LOST_FOUND_CATEGORIES.find((c) => c.key === selectedCategory)?.label.split(' ')[0] || 'Lọc'}
          </Text>
          <Ionicons
            name={showCategories ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={showCategories || selectedCategory !== 'all' ? '#F59E0B' : (isDark ? '#94A3B8' : '#64748B')}
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>
      </View>

      {/* Dải Chips Danh Mục Khi Bật Bộ Lọc */}
      {showCategories && (
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            <TouchableOpacity
              style={[
                styles.categoryFilterChip,
                !isDark && {
                  backgroundColor: selectedCategory === 'all' ? '#F59E0B' : '#FFFFFF',
                  borderColor: selectedCategory === 'all' ? '#F59E0B' : '#E2E8F0',
                },
                selectedCategory === 'all' && isDark && styles.categoryFilterChipActive,
              ]}
              onPress={() => {
                setSelectedCategory('all');
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryFilterChipText,
                  !isDark && { color: selectedCategory === 'all' ? '#0A0F1D' : '#475569' },
                  selectedCategory === 'all' && isDark && styles.categoryFilterChipTextActive,
                ]}
              >
                Tất cả ({items.length})
              </Text>
            </TouchableOpacity>

            {LOST_FOUND_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              const count = items.filter((it) => it.category === cat.key).length;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryFilterChip,
                    !isDark && {
                      backgroundColor: isSelected ? '#F59E0B' : '#FFFFFF',
                      borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                    },
                    isSelected && isDark && styles.categoryFilterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat.key);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={13}
                    color={isSelected ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.categoryFilterChipText,
                      !isDark && { color: isSelected ? '#0A0F1D' : '#475569' },
                      isSelected && isDark && styles.categoryFilterChipTextActive,
                    ]}
                  >
                    {cat.label.split(' ')[0]} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 4. Danh Sách Đồ Thất Lạc */}
      {loading ? (
        <LostFoundListSkeleton />
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="archive-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không có vật phẩm nào</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || selectedCategory !== 'all'
              ? 'Thử thay đổi từ khóa hoặc bộ lọc để xem kết quả khác.'
              : 'Hiện chưa có báo cáo đồ khách để quên trong kho.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
        />
      )}

      {/* Modal Khai Báo Đồ Khách Bỏ Quên */}
      <CreateLostFoundModal
        visible={createModalVisible}
        isDark={isDark}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={fetchLostItems}
      />

      {/* Modal Bàn Giao Trả Khách */}
      <ReturnLostFoundModal
        visible={returnModalVisible}
        item={selectedItem}
        isDark={isDark}
        onClose={() => setReturnModalVisible(false)}
        onSuccess={fetchLostItems}
      />

      {/* Modal Xem Ảnh Hiện Vật Phóng To */}
      <ImagePreviewModal
        imageUrl={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1.5,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  refreshCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  fixedFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 8,
  },
  fixedFilterCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  fixedFilterCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  fixedFilterNumber: {
    fontSize: 16,
    fontWeight: '900',
  },
  fixedFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 1,
  },
  fixedFilterLabelSelected: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12.5,
    paddingHorizontal: 8,
  },
  categoriesContainer: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  categoryScroll: {
    gap: 6,
    paddingRight: 12,
  },
  categoryFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryFilterChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  categoryFilterChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  categoryFilterChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  loadMoreFooter: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  endOfListFooter: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  loadMoreHintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
