import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CartItem } from './types';
import { isTransportService, getServiceItemImage, detectAllergyWarning } from './serviceHelpers';
import { styles } from './styles';

export interface CreateServiceOrderModalProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  loadingModalData: boolean;
  occupiedRooms: any[];
  selectedRoom: any;
  setSelectedRoom: (room: any) => void;
  serviceItems: any[];
  serviceCategories: any[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  handleAddToCart: (s: any) => void;
  handleUpdateCartQuantity: (id: number, delta: number) => void;
  handleRemoveFromCart: (id: number) => void;
  handleUpdateCartItemNote: (id: number, note: string) => void;
  totalCartCount: number;
  totalCartPrice: number;
  deliveryMode: 'now' | 'scheduled';
  setDeliveryMode: (mode: 'now' | 'scheduled') => void;
  scheduledTime: Date;
  setScheduledTime: (date: Date) => void;
  customTimeText: string;
  setCustomTimeText: (text: string) => void;
  orderNote: string;
  setOrderNote: (note: string) => void;
  submittingOrder: boolean;
  handleCreateOrder: () => void;
}

export const CreateServiceOrderModal: React.FC<CreateServiceOrderModalProps> = ({
  visible,
  onClose,
  isDark,
  loadingModalData,
  occupiedRooms,
  selectedRoom,
  setSelectedRoom,
  serviceItems,
  serviceCategories,
  cart,
  setCart,
  handleAddToCart,
  handleUpdateCartQuantity,
  handleRemoveFromCart,
  handleUpdateCartItemNote,
  totalCartCount,
  totalCartPrice,
  deliveryMode,
  setDeliveryMode,
  scheduledTime,
  setScheduledTime,
  customTimeText,
  setCustomTimeText,
  orderNote,
  setOrderNote,
  submittingOrder,
  handleCreateOrder,
}) => {
  const INITIAL_ITEMS_LIMIT = 6;
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [serviceSearchText, setServiceSearchText] = useState('');
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const scrollViewRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setSelectedCategoryId('all');
      setServiceSearchText('');
      setIsExpandedAll(false);
    }
  }, [visible]);

  const filteredServiceItems = useMemo(() => {
    return serviceItems.filter((s) => {
      if (selectedCategoryId !== 'all') {
        const catId = s.category_id || (typeof s.category === 'object' ? s.category?.id : s.category);
        if (catId !== selectedCategoryId) return false;
      }
      if (serviceSearchText.trim()) {
        const q = serviceSearchText.trim().toLowerCase();
        const matchName = s.name && s.name.toLowerCase().includes(q);
        const matchCat = s.category_name && s.category_name.toLowerCase().includes(q);
        const matchDesc = s.description && s.description.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [serviceItems, selectedCategoryId, serviceSearchText]);

  const isSearching = Boolean(serviceSearchText.trim());
  const shouldShowAll = isSearching || isExpandedAll || filteredServiceItems.length <= INITIAL_ITEMS_LIMIT;
  const displayedServiceItems = shouldShowAll
    ? filteredServiceItems
    : filteredServiceItems.slice(0, INITIAL_ITEMS_LIMIT);
  const remainingItemsCount = Math.max(0, filteredServiceItems.length - INITIAL_ITEMS_LIMIT);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View
            style={[
              styles.modalContent,
              { maxHeight: '92%' },
              !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0', shadowColor: '#64748B' },
            ]}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View>
                <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>Gọi Món & Đặt Dịch Vụ Mới</Text>
                <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
                  Tạo đơn ẩm thực, spa, tiện ích cho khách đang ở
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {loadingModalData ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#F59E0B" size="large" />
                <Text style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: 12, fontSize: 13 }}>
                  Đang tải danh sách phòng & menu dịch vụ...
                </Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 35 }}
                keyboardShouldPersistTaps="handled"
              >
              {/* 1. Chọn phòng đang có khách */}
              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>1. Chọn phòng đang có khách *:</Text>
              {occupiedRooms.length === 0 ? (
                <View style={[styles.noRoomsWarning, !isDark && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={[styles.noRoomsText, !isDark && { color: '#B45309' }]}>
                    Hiện không có phòng nào có khách đã nhận phòng (Check-in).
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomChipsScroll}>
                  {occupiedRooms.map((r) => {
                    const isSelected = selectedRoom?.id === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.roomSelectChip,
                          !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                          isSelected && styles.roomSelectChipActive,
                        ]}
                        onPress={() => {
                          setSelectedRoom(r);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.roomSelectChipText,
                            !isDark && !isSelected && { color: '#0F172A' },
                            isSelected && styles.roomSelectChipTextActive,
                          ]}
                        >
                          P.{r.room_number}
                        </Text>
                        <Text
                          style={[
                            styles.roomGuestSubText,
                            !isDark && !isSelected && { color: '#64748B' },
                            isSelected && { color: '#0A0F1D', fontWeight: '700' },
                          ]}
                          numberOfLines={1}
                        >
                          {r.current_booking?.guest_name || 'Khách'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* 2. Chọn món ăn / dịch vụ tiện ích */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 4 }}>
                <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }, !isDark && { color: '#334155' }]}>
                  2. Chọn Món ăn & Dịch vụ ({filteredServiceItems.length}) *:
                </Text>
                {totalCartCount > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.quickCartJumpBtn,
                      !isDark && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                    ]}
                    onPress={() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="cart" size={13} color={isDark ? '#FBBF24' : '#D97706'} />
                    <Text style={[styles.quickCartJumpBtnText, !isDark && { color: '#B45309' }]}>
                      Giỏ ({totalCartCount}) ↓
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Dải Phân Loại Danh Mục */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsScroll}>
                <TouchableOpacity
                  style={[
                    styles.categoryFilterChip,
                    !isDark && selectedCategoryId !== 'all' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    selectedCategoryId === 'all' && styles.categoryFilterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedCategoryId('all');
                    setIsExpandedAll(false);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryFilterChipText,
                      !isDark && selectedCategoryId !== 'all' && { color: '#64748B' },
                      selectedCategoryId === 'all' && styles.categoryFilterChipTextActive,
                    ]}
                  >
                    Tất cả ({serviceItems.length})
                  </Text>
                </TouchableOpacity>

                {serviceCategories
                  .filter((c) => !isTransportService(c))
                  .map((c) => {
                    const isSelected = selectedCategoryId === c.id;
                    const countInCat = serviceItems.filter(
                      (s) => s.category_id === c.id || s.category === c.id
                    ).length;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.categoryFilterChip,
                          !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                          isSelected && styles.categoryFilterChipActive,
                        ]}
                        onPress={() => {
                          setSelectedCategoryId(c.id);
                          setIsExpandedAll(false);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons
                            name="pricetag-outline"
                            size={12}
                            color={isSelected ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
                          />
                          <Text
                            style={[
                              styles.categoryFilterChipText,
                              !isDark && !isSelected && { color: '#64748B' },
                              isSelected && styles.categoryFilterChipTextActive,
                            ]}
                          >
                            {c.name} ({countInCat})
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>

              {/* Ô tìm kiếm nhanh món/dịch vụ */}
              <View style={[styles.modalSearchBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
                <Ionicons name="search-outline" size={16} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.modalSearchInput, !isDark && { color: '#0F172A' }]}
                  placeholder="Tìm nhanh: Wagyu, Trà chiều, Massage, Giặt hấp, Gối..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  value={serviceSearchText}
                  onChangeText={setServiceSearchText}
                />
                {serviceSearchText ? (
                  <TouchableOpacity onPress={() => setServiceSearchText('')}>
                    <Ionicons name="close-circle" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Danh sách thẻ dịch vụ */}
              <View style={styles.serviceItemsGrid}>
                {filteredServiceItems.length === 0 ? (
                  <View style={[styles.emptyServiceNotice, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="search-outline" size={24} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginBottom: 6 }} />
                    <Text style={[styles.emptyServiceNoticeText, !isDark && { color: '#64748B' }]}>
                      Không tìm thấy dịch vụ hoặc món ăn phù hợp.
                    </Text>
                  </View>
                ) : (
                  displayedServiceItems.map((s) => {
                    const cartItem = cart.find((i) => i.service.id === s.id);
                    const inCart = Boolean(cartItem);
                    const priceNum = s.price ? parseInt(s.price, 10) : 0;
                    return (
                      <View
                        key={s.id}
                        style={[
                          styles.serviceSelectCard,
                          !isDark && !inCart && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                          inCart && styles.serviceSelectCardActive,
                        ]}
                      >
                        <Image source={{ uri: getServiceItemImage(s) }} style={styles.modalItemThumbnail} resizeMode="cover" />
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={[styles.serviceCatTag, !isDark && { backgroundColor: '#EEF2F6', borderColor: '#E2E8F0' }, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                            <Ionicons name="pricetag-outline" size={10} color={isDark ? '#94A3B8' : '#475569'} />
                            <Text style={[styles.serviceCatTagText, !isDark && { color: '#475569' }]}>
                              {s.category_name || 'Dịch vụ'}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.serviceCardTitle,
                              !isDark && !inCart && { color: '#0F172A' },
                              inCart && styles.serviceCardTitleActive,
                            ]}
                            numberOfLines={2}
                          >
                            {s.name}
                          </Text>
                          {s.description ? (
                            <Text style={[styles.serviceCardDesc, !isDark && { color: '#64748B' }]} numberOfLines={1}>
                              {s.description}
                            </Text>
                          ) : null}
                          <Text style={styles.serviceCardPrice}>
                            {priceNum > 0 ? `${priceNum.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                          </Text>
                        </View>

                        {/* Stepper tăng giảm hoặc nút thêm vào giỏ */}
                        {inCart && cartItem ? (
                          <View style={styles.modalCardStepper}>
                            <TouchableOpacity
                              style={styles.modalCardStepperBtn}
                              onPress={() => handleUpdateCartQuantity(s.id, -1)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="remove" size={14} color="#0A0F1D" />
                            </TouchableOpacity>
                            <Text style={styles.modalCardStepperQty}>{cartItem.quantity}</Text>
                            <TouchableOpacity
                              style={styles.modalCardStepperBtn}
                              onPress={() => handleUpdateCartQuantity(s.id, 1)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="add" size={14} color="#0A0F1D" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.modalCardAddBtn, !isDark && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}
                            onPress={() => handleAddToCart(s)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add" size={14} color="#D97706" style={{ marginRight: 2 }} />
                            <Text style={[styles.modalCardAddBtnText, !isDark && { color: '#B45309' }]}> Thêm</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </View>

              {/* Nút Xem thêm / Thu gọn khi danh sách có nhiều món */}
              {!isSearching && filteredServiceItems.length > INITIAL_ITEMS_LIMIT && (
                <TouchableOpacity
                  style={[
                    styles.expandToggleBtn,
                    !isDark && {
                      backgroundColor: isExpandedAll ? '#F1F5F9' : '#FEF3C7',
                      borderColor: isExpandedAll ? '#CBD5E1' : '#FDE68A',
                    },
                  ]}
                  onPress={() => {
                    setIsExpandedAll((prev) => !prev);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isExpandedAll ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'}
                    size={16}
                    color={isExpandedAll ? (isDark ? '#94A3B8' : '#64748B') : (isDark ? '#FBBF24' : '#B45309')}
                  />
                  <Text
                    style={[
                      styles.expandToggleBtnText,
                      !isDark && { color: isExpandedAll ? '#475569' : '#B45309' },
                    ]}
                  >
                    {isExpandedAll
                      ? 'Thu gọn danh sách món'
                      : `Xem thêm (còn ${remainingItemsCount} món khác)`}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 3. Giỏ món & dịch vụ đã chọn */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
                <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }, !isDark && { color: '#334155' }]}>
                  3. Giỏ món đã chọn ({totalCartCount} món) *:
                </Text>
                {cart.length > 0 && (
                  <TouchableOpacity onPress={() => setCart([])} style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>Xóa hết giỏ</Text>
                  </TouchableOpacity>
                )}
              </View>

              {cart.length === 0 ? (
                <View style={[styles.emptyCartBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
                  <Ionicons name="cart-outline" size={26} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginBottom: 6 }} />
                  <Text style={[styles.emptyCartText, !isDark && { color: '#64748B' }]}>
                    Giỏ hàng đang trống. Vui lòng bấm [+ Thêm] ở danh sách trên.
                  </Text>
                </View>
              ) : (
                <View style={styles.cartItemsList}>
                  {cart.map((item, idx) => {
                    const itemPrice = parseFloat(item.service.price || '0');
                    const subTotal = (isNaN(itemPrice) ? 0 : itemPrice) * item.quantity;
                    return (
                      <View
                        key={item.service.id}
                        style={[styles.cartItemRow, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[styles.cartItemName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                              {idx + 1}. {item.service.name}
                            </Text>
                            <Text style={styles.cartItemPriceText}>
                              {itemPrice > 0
                                ? `${itemPrice.toLocaleString('vi-VN')} đ × ${item.quantity} = ${subTotal.toLocaleString('vi-VN')} đ`
                                : 'Miễn phí'}
                            </Text>
                          </View>

                          {/* Stepper trong giỏ */}
                          <View style={styles.cartStepperRow}>
                            <TouchableOpacity
                              style={[styles.cartQtyBtn, !isDark && { backgroundColor: '#E2E8F0' }]}
                              onPress={() => handleUpdateCartQuantity(item.service.id, -1)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="remove" size={13} color={isDark ? '#F8FAFC' : '#0F172A'} />
                            </TouchableOpacity>
                            <Text style={[styles.cartQtyText, !isDark && { color: '#0F172A' }]}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={[styles.cartQtyBtn, !isDark && { backgroundColor: '#E2E8F0' }]}
                              onPress={() => handleUpdateCartQuantity(item.service.id, 1)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="add" size={13} color={isDark ? '#F8FAFC' : '#0F172A'} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cartDeleteBtn}
                              onPress={() => handleRemoveFromCart(item.service.id)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash-outline" size={15} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Ghi chú riêng từng món */}
                        <TextInput
                          style={[
                            styles.cartItemNoteInput,
                            !isDark && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#0F172A' },
                          ]}
                          placeholder={`Ghi chú cho món này (VD: Ít cay, không hành, nóng...)`}
                          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                          value={item.note || ''}
                          onChangeText={(txt) => handleUpdateCartItemNote(item.service.id, txt)}
                        />
                        {detectAllergyWarning(item.note) && (
                          <View
                            style={[
                              styles.allergyBanner,
                              { marginTop: 6, marginBottom: 2, paddingVertical: 6, paddingHorizontal: 8 },
                              !isDark && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                            ]}
                          >
                            <View style={styles.allergyBannerTitleRow}>
                              <Ionicons name="warning" size={13} color="#DC2626" style={{ marginRight: 4 }} />
                              <Text style={[styles.allergyBannerTitle, { fontSize: 11 }, !isDark && { color: '#B91C1C' }]}>
                                {detectAllergyWarning(item.note)?.title}
                              </Text>
                            </View>
                            <Text style={[styles.allergyBannerText, { fontSize: 11, marginTop: 1 }, !isDark && { color: '#991B1B' }]}>
                              Yêu cầu đặc biệt cho món này đã được ghi nhận!
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Tổng cộng giỏ hàng */}
                  <View
                    style={[
                      styles.cartTotalSummary,
                      !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                    ]}
                  >
                    <Text style={[styles.cartTotalLabel, !isDark && { color: '#92400E' }]}>
                      Tổng cộng ({totalCartCount} món):
                    </Text>
                    <Text style={styles.cartTotalPrice}>{totalCartPrice.toLocaleString('vi-VN')} đ</Text>
                  </View>
                </View>
              )}

              {/* 4. Thời gian phục vụ */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>4. Thời gian phục vụ:</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <TouchableOpacity
                  style={[
                    styles.deliveryModeBtn,
                    !isDark && deliveryMode !== 'now' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    deliveryMode === 'now' && styles.deliveryModeBtnActive,
                  ]}
                  onPress={() => {
                    setDeliveryMode('now');
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="flash"
                    size={15}
                    color={deliveryMode === 'now' ? '#0A0F1D' : '#F59E0B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.deliveryModeBtnText,
                      !isDark && deliveryMode !== 'now' && { color: '#475569' },
                      deliveryMode === 'now' && styles.deliveryModeBtnTextActive,
                    ]}
                  >
                    Giao ngay (Bếp làm luôn)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deliveryModeBtn,
                    !isDark && deliveryMode !== 'scheduled' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    deliveryMode === 'scheduled' && styles.deliveryModeBtnActive,
                  ]}
                  onPress={() => {
                    setDeliveryMode('scheduled');
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="alarm"
                    size={15}
                    color={deliveryMode === 'scheduled' ? '#0A0F1D' : '#38BDF8'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.deliveryModeBtnText,
                      !isDark && deliveryMode !== 'scheduled' && { color: '#475569' },
                      deliveryMode === 'scheduled' && styles.deliveryModeBtnTextActive,
                    ]}
                  >
                    Hẹn giờ giao
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tùy chọn giờ hẹn nếu chọn "Hẹn giờ giao" */}
              {deliveryMode === 'scheduled' && (
                <View style={[styles.scheduledBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                  <Text style={[styles.scheduledSubLabel, !isDark && { color: '#64748B' }]}>Chọn nhanh mốc hẹn:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: '+15 phút', minutes: 15 },
                      { label: '+30 phút', minutes: 30 },
                      { label: '+45 phút', minutes: 45 },
                      { label: '+1 tiếng', minutes: 60 },
                      { label: '+2 tiếng', minutes: 120 },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.label}
                        style={[styles.quickTimeChip, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }]}
                        onPress={() => {
                          const d = new Date();
                          d.setMinutes(d.getMinutes() + opt.minutes);
                          setScheduledTime(d);
                          setCustomTimeText(
                            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                          );
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.quickTimeChipText, !isDark && { color: '#334155' }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.scheduledSubLabel, !isDark && { color: '#64748B' }]}>
                    Hoặc nhập giờ hẹn cụ thể (HH:mm):
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TextInput
                      style={[
                        styles.timeInput,
                        !isDark && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#0F172A' },
                      ]}
                      placeholder="VD: 10:00, 11:30"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      value={customTimeText}
                      onChangeText={(txt) => {
                        setCustomTimeText(txt);
                        const match = txt.trim().match(/^(\d{1,2}):(\d{2})$/);
                        if (match) {
                          const h = parseInt(match[1], 10);
                          const m = parseInt(match[2], 10);
                          if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                            const d = new Date();
                            d.setHours(h, m, 0, 0);
                            if (d.getTime() < Date.now()) {
                              d.setDate(d.getDate() + 1);
                            }
                            setScheduledTime(d);
                          }
                        }
                      }}
                      keyboardType="numbers-and-punctuation"
                    />
                    <View
                      style={[
                        styles.scheduledPreviewBadge,
                        !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                      ]}
                    >
                      <Ionicons name="time" size={14} color="#FBBF24" style={{ marginRight: 5 }} />
                      <Text style={[styles.scheduledPreviewText, !isDark && { color: '#B45309' }]}>
                        Hẹn: {scheduledTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {scheduledTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 5. Ghi chú chung */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>
                5. Ghi chú chung cho toàn đơn (tùy chọn):
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 54, paddingTop: 8 },
                  !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                ]}
                placeholder="VD: Giao tất cả cùng lúc, mang thêm 2 bộ chén đĩa..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                multiline
                value={orderNote}
                onChangeText={setOrderNote}
              />

              {detectAllergyWarning(orderNote) && (
                <View
                  style={[
                    styles.allergyBanner,
                    { marginTop: 8, marginBottom: 12 },
                    !isDark && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                  ]}
                >
                  <View style={styles.allergyBannerTitleRow}>
                    <Ionicons name="warning" size={15} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={[styles.allergyBannerTitle, !isDark && { color: '#B91C1C' }]}>
                      {detectAllergyWarning(orderNote)?.title}
                    </Text>
                  </View>
                  <Text style={[styles.allergyBannerText, !isDark && { color: '#991B1B' }]}>
                    Hệ thống đã nhận diện lưu ý sức khỏe/ăn kiêng và sẽ ghim cảnh báo đỏ cho Bếp & Nhân viên phục vụ!
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  (!selectedRoom || cart.length === 0 || submittingOrder) && { opacity: 0.6 },
                ]}
                onPress={handleCreateOrder}
                disabled={!selectedRoom || cart.length === 0 || submittingOrder}
                activeOpacity={0.8}
              >
                {submittingOrder ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="paper-plane" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.modalConfirmBtnText}>
                      {totalCartCount > 0
                        ? `GỬI ĐƠN PHỤC VỤ (${totalCartCount} MÓN) • ${totalCartPrice.toLocaleString('vi-VN')} đ`
                        : 'VUI LÒNG CHỌN MÓN VÀO GIỎ'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);
};
