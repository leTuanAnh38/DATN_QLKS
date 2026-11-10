import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { isTransportService, isHousekeepingService } from './serviceHelpers';
import { styles } from './styles';
import { CatalogItemCard } from './CatalogItemCard';

export interface ServiceCatalogViewProps {
  isDark: boolean;
  onOrder: (serviceId?: number) => void;
  onCatalogLoaded?: (count: number) => void;
}

export const ServiceCatalogView: React.FC<ServiceCatalogViewProps> = ({
  isDark,
  onOrder,
  onCatalogLoaded,
}) => {
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<number | 'all'>('all');
  const [catalogSearchText, setCatalogSearchText] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingCatalogId, setTogglingCatalogId] = useState<number | null>(null);

  // Phân trang danh mục món
  const [visibleCatalogCount, setVisibleCatalogCount] = useState(16);
  const [loadingMoreCatalog, setLoadingMoreCatalog] = useState(false);

  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [resItems, resCats] = await Promise.all([
        apiClient.get('/services/items/?all=true'),
        apiClient.get('/services/categories/'),
      ]);
      const items = resItems.data.results || resItems.data.items || resItems.data.data || resItems.data || [];
      const validCatalog = (Array.isArray(items) ? items : []).filter(
        (s: any) => !isTransportService(s) && !isHousekeepingService(s)
      );
      setCatalogItems(validCatalog);
      if (onCatalogLoaded) {
        onCatalogLoaded(validCatalog.length);
      }

      const cats = resCats.data.categories || resCats.data.results || resCats.data.data || resCats.data || [];
      setCatalogCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.warn('Lỗi tải danh mục thực đơn:', err);
    } finally {
      setLoadingCatalog(false);
      setRefreshing(false);
    }
  }, [onCatalogLoaded]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleCatalogCount(16);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchCatalog();
  };

  const handleToggleCatalogActive = async (item: any) => {
    if (togglingCatalogId === item.id) return;
    const isCurrentlyActive = item.is_active !== false;
    const nextStatusText = isCurrentlyActive ? 'Tạm hết món / Ngưng phục vụ' : 'Mở phục vụ lại';

    Alert.alert(
      'Chuyển trạng thái thực đơn',
      `Bạn có chắc chắn muốn chuyển món "${item.name}" sang: "${nextStatusText}"?`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: isCurrentlyActive ? 'Báo hết món' : 'Mở phục vụ',
          style: isCurrentlyActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setTogglingCatalogId(item.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const res = await apiClient.patch(`/services/items/${item.id}/toggle-active/`);
              if (res.data?.success) {
                const updatedActive = res.data?.is_active ?? !isCurrentlyActive;
                setCatalogItems((prev) =>
                  prev.map((it) => (it.id === item.id ? { ...it, is_active: updatedActive } : it))
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  'Thành công',
                  res.data?.message || `Đã cập nhật trạng thái món sang: ${updatedActive ? 'Đang phục vụ' : 'Tạm hết món'}`
                );
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái món ăn/dịch vụ.';
              Alert.alert('Lỗi', msg);
            } finally {
              setTogglingCatalogId(null);
            }
          },
        },
      ]
    );
  };

  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((item) => {
      let matchCat = true;
      if (catalogCategoryFilter !== 'all') {
        const itemCatId = item.category_id || (typeof item.category === 'object' ? item.category?.id : item.category);
        matchCat = itemCatId === catalogCategoryFilter;
      }

      const q = catalogSearchText.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.category_name && item.category_name.toLowerCase().includes(q));

      return matchCat && matchSearch;
    });
  }, [catalogItems, catalogCategoryFilter, catalogSearchText]);

  useEffect(() => {
    setVisibleCatalogCount(16);
  }, [catalogCategoryFilter, catalogSearchText]);

  const displayedCatalogItems = useMemo(() => {
    return filteredCatalogItems.slice(0, visibleCatalogCount);
  }, [filteredCatalogItems, visibleCatalogCount]);

  const handleLoadMoreCatalog = () => {
    if (loadingMoreCatalog || visibleCatalogCount >= filteredCatalogItems.length) return;
    setLoadingMoreCatalog(true);
    setTimeout(() => {
      setVisibleCatalogCount((prev) => Math.min(prev + 16, filteredCatalogItems.length));
      setLoadingMoreCatalog(false);
    }, 250);
  };

  const renderCatalogFooter = () => {
    if (filteredCatalogItems.length <= 16) return <View style={{ height: 25 }} />;
    if (loadingMoreCatalog) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm món & dịch vụ...</Text>
        </View>
      );
    }
    if (visibleCatalogCount >= filteredCatalogItems.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredCatalogItems.length} món & dịch vụ</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCatalogCount}/{filteredCatalogItems.length} món • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

  const renderCatalogCard = useCallback(
    ({ item }: { item: any }) => (
      <CatalogItemCard
        item={item}
        isDark={isDark}
        isToggling={togglingCatalogId === item.id}
        onToggleActive={handleToggleCatalogActive}
        onOrder={(it) => onOrder(it.id)}
      />
    ),
    [isDark, togglingCatalogId, handleToggleCatalogActive, onOrder]
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Category Filter Pills */}
      <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catalogCatScroll}>
          <TouchableOpacity
            style={[
              styles.catalogCatChip,
              !isDark && {
                backgroundColor: catalogCategoryFilter === 'all' ? '#F59E0B' : '#FFFFFF',
                borderColor: catalogCategoryFilter === 'all' ? '#F59E0B' : '#E2E8F0',
                shadowColor: '#64748B',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              },
              catalogCategoryFilter === 'all' && isDark && styles.catalogCatChipActive,
            ]}
            onPress={() => {
              setCatalogCategoryFilter('all');
              Haptics.selectionAsync();
            }}
          >
            <Text
              style={[
                styles.catalogCatChipText,
                !isDark && { color: catalogCategoryFilter === 'all' ? '#0A0F1D' : '#475569' },
                catalogCategoryFilter === 'all' && isDark && styles.catalogCatChipTextActive,
              ]}
            >
              Tất cả ({catalogItems.length})
            </Text>
          </TouchableOpacity>

          {catalogCategories
            .filter((c: any) => c.type !== 'transport' && !c.name.toLowerCase().includes('xe'))
            .map((cat: any) => {
              const isSelected = catalogCategoryFilter === cat.id;
              const count = catalogItems.filter(
                (s: any) => (s.category_id || (typeof s.category === 'object' ? s.category?.id : s.category)) === cat.id
              ).length;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catalogCatChip,
                    !isDark && {
                      backgroundColor: isSelected ? '#F59E0B' : '#FFFFFF',
                      borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                      shadowColor: '#64748B',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                      elevation: 1,
                    },
                    isSelected && isDark && styles.catalogCatChipActive,
                  ]}
                  onPress={() => {
                    setCatalogCategoryFilter(cat.id);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text
                    style={[
                      styles.catalogCatChipText,
                      !isDark && { color: isSelected ? '#0A0F1D' : '#475569' },
                      isSelected && isDark && styles.catalogCatChipTextActive,
                    ]}
                  >
                    {cat.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>

      {/* Search Box */}
      <View style={[styles.searchWrapper, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <Ionicons name="search-outline" size={18} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 12 }} />
        <TextInput
          style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
          placeholder="Tìm tên món ăn, đồ uống, spa, dịch vụ..."
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={catalogSearchText}
          onChangeText={setCatalogSearchText}
          clearButtonMode="while-editing"
        />
        {catalogSearchText ? (
          <TouchableOpacity onPress={() => setCatalogSearchText('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Catalog List */}
      {loadingCatalog ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingMessage}>Đang tải thực đơn & bảng giá...</Text>
        </View>
      ) : filteredCatalogItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="book-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không tìm thấy món hoặc dịch vụ nào</Text>
          <Text style={styles.emptySubtitle}>Hãy thử chọn danh mục khác hoặc xóa từ khóa tìm kiếm.</Text>
        </View>
      ) : (
        <FlatList
          data={displayedCatalogItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCatalogCard}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 25 }]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMoreCatalog}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderCatalogFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
        />
      )}
    </View>
  );
};

