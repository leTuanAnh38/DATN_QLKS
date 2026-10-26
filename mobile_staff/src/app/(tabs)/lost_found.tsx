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
  Modal,
  TextInput,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';

interface LostFoundItem {
  id: number;
  tracking_code: string;
  room: number | null;
  room_number: string;
  location_found: string;
  item_name: string;
  category: string;
  category_display?: string;
  description: string;
  image?: string | null;
  image_url?: string | null;
  found_date: string;
  finder_name: string;
  guest_name: string;
  guest_phone: string;
  storage_location: string;
  status: 'stored' | 'contacted' | 'returned' | 'disposed';
  status_display?: string;
  returned_date?: string;
  returned_to?: string;
  return_note?: string;
}

const CATEGORIES = [
  { key: 'electronics', label: 'Điện tử (Điện thoại, Laptop, Sạc)', icon: 'phone-portrait' },
  { key: 'valuable', label: 'Giá trị (Ví, Tiền mặt, Trang sức)', icon: 'diamond' },
  { key: 'documents', label: 'Giấy tờ / Hộ chiếu / CCCD', icon: 'document-text' },
  { key: 'clothing', label: 'Quần áo / Giày dép / Túi xách', icon: 'shirt' },
  { key: 'accessories', label: 'Phụ kiện / Kính mắt / Mỹ phẩm', icon: 'glasses' },
  { key: 'other', label: 'Đồ dùng khác', icon: 'cube' },
];

export default function LostFoundScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Khai báo đồ nhặt được mới
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemName, setItemName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [locationFound, setLocationFound] = useState('');
  const [category, setCategory] = useState('valuable');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal Xem ảnh phóng to
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Modal Trả đồ cho khách
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [returnedTo, setReturnedTo] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [returning, setReturning] = useState(false);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần cấp quyền', 'Ứng dụng cần quyền Camera để chụp ảnh hiện vật.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần cấp quyền', 'Ứng dụng cần quyền Thư viện ảnh để chọn ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

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
    const returned = items.filter((it) => it.status === 'returned').length;
    return { total, stored, returned };
  }, [items]);

  // Bộ lọc
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      let matchStatus = true;
      if (filterStatus === 'stored') {
        matchStatus = it.status === 'stored' || it.status === 'contacted';
      } else if (filterStatus === 'returned') {
        matchStatus = it.status === 'returned';
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (it.item_name && it.item_name.toLowerCase().includes(q)) ||
        (it.tracking_code && it.tracking_code.toLowerCase().includes(q)) ||
        (it.location_found && it.location_found.toLowerCase().includes(q)) ||
        (it.guest_name && it.guest_name.toLowerCase().includes(q));

      return matchStatus && matchSearch;
    });
  }, [items, filterStatus, searchQuery]);

  // Infinite Scroll
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(15);
  }, [filterStatus, searchQuery]);

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

  // Khai báo đồ thất lạc mới
  const handleCreate = async () => {
    if (!itemName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên đồ vật nhặt được.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('item_name', itemName.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append(
        'location_found',
        roomNumber.trim() ? `Phòng ${roomNumber.trim()}` : (locationFound.trim() || 'Khu vực khách sạn')
      );

      if (selectedImage) {
        const uri = selectedImage.uri;
        const filename = uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image', {
          uri: uri,
          name: filename,
          type: type,
        });
      }

      const res = await apiClient.post('/rooms/lost-and-found/', formData);
      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', 'Đã ghi nhận đồ thất lạc và thông báo tới Lễ tân lưu kho!');
        setCreateModalVisible(false);
        setItemName('');
        setRoomNumber('');
        setLocationFound('');
        setDescription('');
        setSelectedImage(null);
        fetchLostItems();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể ghi nhận đồ thất lạc.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Trao trả đồ cho khách
  const handleReturn = async () => {
    if (!selectedItem) return;
    if (!returnedTo.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người nhận lại đồ (Khách hàng).');
      return;
    }

    setReturning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await apiClient.post(`/rooms/lost-and-found/${selectedItem.id}/return/`, {
        returned_to: returnedTo.trim(),
        return_note: returnNote.trim(),
      });

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', 'Đã cập nhật biên bản trao trả đồ cho khách!');
        setReturnModalVisible(false);
        setReturnedTo('');
        setReturnNote('');
        fetchLostItems();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật trao trả đồ.';
      Alert.alert('Lỗi', msg);
    } finally {
      setReturning(false);
    }
  };

  const handleMarkContacted = async (item: LostFoundItem) => {
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
    }
  };

  const renderItem = ({ item }: { item: LostFoundItem }) => {
    const isStored = item.status === 'stored';
    const isContacted = item.status === 'contacted';
    const isReturned = item.status === 'returned';

    const getStatusStyle = () => {
      if (isStored) {
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.4)',
          text: '#FBBF24',
          label: 'Đang lưu kho',
          icon: 'archive' as const,
        };
      }
      if (isContacted) {
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.4)',
          text: '#38BDF8',
          label: 'Đã báo khách',
          icon: 'call' as const,
        };
      }
      return {
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.4)',
        text: '#34D399',
        label: 'Đã trao trả',
        icon: 'checkmark-circle' as const,
      };
    };

    const statusObj = getStatusStyle();

    return (
      <View style={[styles.card, (isStored || isContacted) && styles.cardStored]}>
        {/* Header thẻ */}
        <View style={styles.cardHeader}>
          <View style={styles.locationTag}>
            <Ionicons name="location" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.locationTagText} numberOfLines={1}>
              {item.location_found || 'Khách sạn'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusObj.bg,
                borderColor: statusObj.border,
              },
            ]}
          >
            <Ionicons
              name={statusObj.icon}
              size={12}
              color={statusObj.text}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.statusBadgeText,
                { color: statusObj.text },
              ]}
            >
              {statusObj.label}
            </Text>
          </View>
        </View>

        {/* Tên đồ vật & Mã & Ảnh chụp hiện vật */}
        <View style={styles.itemTitleRow}>
          {item.image_url || item.image ? (
            <TouchableOpacity
              onPress={() => setPreviewImageUrl(item.image_url || item.image || null)}
              activeOpacity={0.8}
              style={styles.itemThumbWrapper}
            >
              <Image
                source={{ uri: item.image_url || item.image || '' }}
                style={styles.itemThumbnail}
                resizeMode="cover"
              />
              <View style={styles.zoomBadge}>
                <Ionicons name="scan" size={10} color="#FFF" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.itemIconBox}>
              <Ionicons name="cube" size={20} color="#F59E0B" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <Text style={styles.trackingCode}>Mã: #{item.tracking_code}</Text>
            {item.room_number ? (
              <Text style={styles.roomLinkText}>Phòng liên quan: P.{item.room_number}</Text>
            ) : null}
          </View>
        </View>

        {/* Mô tả đặc điểm */}
        {item.description ? (
          <View style={styles.descBox}>
            <Text style={styles.descText}>Chi tiết: {item.description}</Text>
          </View>
        ) : null}

        {/* Thông tin khách hàng liên quan nếu có */}
        {item.guest_name ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Khách liên quan:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={[styles.infoValue, { color: '#60A5FA', fontWeight: '700' }]}>
                {item.guest_name}
              </Text>
              {item.guest_phone ? (
                <TouchableOpacity
                  style={styles.callGuestMiniBtn}
                  onPress={() => Linking.openURL(`tel:${item.guest_phone}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={11} color="#34D399" style={{ marginRight: 3 }} />
                  <Text style={styles.callGuestMiniText}>{item.guest_phone}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Thông tin lưu kho & Người nhặt */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Kho cất giữ:</Text>
          <Text style={styles.infoValue}>{item.storage_location || 'Két an toàn Lễ tân'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phát hiện:</Text>
          <Text style={styles.infoValue}>
            {new Date(item.found_date).toLocaleDateString('vi-VN')} • {item.finder_name || 'Buồng phòng'}
          </Text>
        </View>

        {/* Nút hành động */}
        {(isStored || isContacted) ? (
          <View style={styles.actionRowLF}>
            {isStored && (
              <TouchableOpacity
                style={styles.contactActionBtn}
                onPress={() => handleMarkContacted(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="call-outline" size={13} color="#38BDF8" style={{ marginRight: 4 }} />
                <Text style={styles.contactActionBtnText}>Đã gọi khách</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.returnActionBtn}
              onPress={() => {
                setSelectedItem(item);
                setReturnedTo(item.guest_name || '');
                setReturnNote('');
                setReturnModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="hand-left" size={14} color="#0A0F1D" style={{ marginRight: 5 }} />
              <Text style={styles.returnActionBtnText}>BÀN GIAO TRẢ KHÁCH</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.returnedInfoBox}>
            <Ionicons name="shield-checkmark" size={14} color="#34D399" style={{ marginRight: 6 }} />
            <Text style={styles.returnedInfoText}>
              Đã trao trả cho: {item.returned_to || 'Khách hàng'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle}>Đồ Thất Lạc 🧳</Text>
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
            style={styles.refreshCircleBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'all', label: 'Tất cả', count: stats.total, color: '#F8FAFC' },
          { key: 'stored', label: 'Đang lưu kho', count: stats.stored, color: '#F59E0B' },
          { key: 'returned', label: 'Đã trao trả', count: stats.returned, color: '#34D399' },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                isSelected && styles.fixedFilterCardSelected,
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
                  isSelected && styles.fixedFilterLabelSelected,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Ô Tìm Kiếm Nhanh */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tên đồ vật, mã #LF, số phòng..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 4. Danh Sách Đồ Thất Lạc */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingMessage}>Đang tải sổ đồ thất lạc...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="archive-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không có đồ thất lạc nào</Text>
          <Text style={styles.emptySubtitle}>
            Hiện chưa có tài sản khách bỏ quên nào cần xử lý trong mục này.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
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

      {/* Modal Khai Báo Đồ Nhặt Được Mới */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Khai Báo Đồ Khách Bỏ Quên</Text>
                <Text style={styles.modalSubtitle}>Ghi nhận vào sổ Lost & Found để Lễ tân quản lý</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCreateModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Tên vật phẩm nhặt được (*):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: Ví nam cầm tay, Tai nghe AirPods, Hộ chiếu..."
                placeholderTextColor="#64748B"
                value={itemName}
                onChangeText={setItemName}
              />

              <Text style={styles.inputLabel}>Số phòng phát hiện (hoặc khu vực):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: 204 (hoặc Hồ bơi tầng 3, Ghế sảnh...)"
                placeholderTextColor="#64748B"
                value={roomNumber}
                onChangeText={setRoomNumber}
              />

              <Text style={styles.inputLabel}>Phân loại tài sản:</Text>
              <View style={styles.categoryChipsRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.categoryChip, category === c.key && styles.categoryChipActive]}
                    onPress={() => setCategory(c.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={c.icon as any}
                      size={13}
                      color={category === c.key ? '#0A0F1D' : '#94A3B8'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === c.key && styles.categoryChipTextActive,
                      ]}
                    >
                      {c.label.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Mô tả đặc điểm / Vị trí tìm thấy:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="VD: Nhặt được dưới chân giường, màu đen da bò..."
                placeholderTextColor="#64748B"
                multiline
                value={description}
                onChangeText={setDescription}
              />

              {/* Chụp ảnh hiện vật */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Ảnh chụp hiện vật (Camera hoặc Thư viện):</Text>
              {selectedImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <View style={styles.imagePreviewOverlay}>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={takePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Chụp lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => setSelectedImage(null)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Xóa ảnh</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPickerRow}>
                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={takePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color="#F59E0B" />
                    <Text style={styles.photoPickerText}>Chụp ảnh camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={pickImage}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={20} color="#60A5FA" />
                    <Text style={[styles.photoPickerText, { color: '#60A5FA' }]}>Chọn từ thư viện</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalConfirmBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="cloud-upload" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.modalConfirmBtnText}>LƯU VÀO SỔ LỄ TÂN</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Bàn Giao Trả Khách */}
      <Modal visible={returnModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCenterContent}>
            <Text style={styles.modalTitle}>Bàn Giao Trả Khách</Text>
            <Text style={styles.modalSubtitle}>
              Vật phẩm: {selectedItem?.item_name} (#{selectedItem?.tracking_code})
            </Text>

            <Text style={styles.inputLabel}>Họ tên người nhận lại (*):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="VD: Anh Tuấn (SĐT: 0912...)"
              placeholderTextColor="#64748B"
              value={returnedTo}
              onChangeText={setReturnedTo}
            />

            <Text style={styles.inputLabel}>Ghi chú biên bản bàn giao:</Text>
            <TextInput
              style={[styles.modalInput, { height: 50 }]}
              placeholder="Khách đã kiểm tra đủ tài sản..."
              placeholderTextColor="#64748B"
              value={returnNote}
              onChangeText={setReturnNote}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReturnModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleReturn}
                disabled={returning}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveText}>Xác Nhận Đã Trả</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Xem Ảnh Hiện Vật Phóng To */}
      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity
            style={styles.fullImageCloseBtn}
            onPress={() => setPreviewImageUrl(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={32} color="#FFF" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  fixedFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 10,
  },
  fixedFilterCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 9,
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
    marginTop: 2,
  },
  fixedFilterLabelSelected: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    height: 42,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    paddingHorizontal: 10,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingMessage: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 13,
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
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardStored: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: '55%',
  },
  locationTagText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  trackingCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  descBox: {
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  descText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  returnActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 40,
    borderRadius: 12,
    marginTop: 10,
  },
  returnActionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  returnedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  returnedInfoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCenterContent: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 12,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    color: '#F8FAFC',
    fontSize: 13,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  categoryChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  categoryChipTextActive: {
    color: '#0A0F1D',
  },
  modalConfirmBtn: {
    backgroundColor: '#F59E0B',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  modalConfirmBtnText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSaveBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalSaveText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
  },
  itemThumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  itemThumbnail: {
    width: '100%',
    height: '100%',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    padding: 2,
  },
  roomLinkText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
    marginTop: 2,
  },
  imagePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imagePreview: {
    width: '100%',
    height: 150,
  },
  imagePreviewOverlay: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    gap: 8,
  },
  imageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageActionBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  photoPickerBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    gap: 6,
  },
  photoPickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 99,
  },
  fullImage: {
    width: '92%',
    height: '75%',
  },
  callGuestMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  callGuestMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  actionRowLF: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  contactActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 10,
  },
  contactActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
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
