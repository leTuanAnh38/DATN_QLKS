import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getServiceItemImage } from './serviceHelpers';
import { styles } from './styles';

export interface CatalogItemCardProps {
  item: any;
  isDark: boolean;
  isToggling: boolean;
  onToggleActive: (item: any) => void;
  onOrder: (item: any) => void;
}

export const CatalogItemCard: React.FC<CatalogItemCardProps> = React.memo(({
  item,
  isDark,
  isToggling,
  onToggleActive,
  onOrder,
}) => {
  const priceFormatted = item.price ? `${parseInt(item.price, 10).toLocaleString('vi-VN')} đ` : 'Miễn phí';
  const imageUri = getServiceItemImage(item);
  const isAvailable = item.is_active !== false;

  const handleOrderPress = () => {
    if (!isAvailable) {
      Alert.alert(
        'Món đang tạm hết',
        `Món "${item.name}" đang được đánh dấu là tạm hết. Bạn có muốn mở lại món này trước khi gọi cho khách không?`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Mở lại phục vụ', onPress: () => onToggleActive(item) },
        ]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOrder(item);
  };

  return (
    <View
      style={[
        styles.catalogCard,
        !isAvailable && { opacity: 0.8 },
        !isDark && {
          backgroundColor: '#FFFFFF',
          borderColor: isAvailable ? '#E2E8F0' : '#FECACA',
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
      ]}
    >
      <View style={styles.catalogItemImgWrapper}>
        <Image
          source={{ uri: imageUri }}
          style={[styles.catalogItemImg, !isAvailable && { opacity: 0.45 }]}
          resizeMode="cover"
        />
        {!isAvailable ? (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutBadgeText}>TẠM HẾT MÓN</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.catalogItemContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.catalogItemName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.catalogCategoryTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
            <Text style={[styles.catalogCategoryTagText, !isDark && { color: '#64748B' }]}>{item.category_name || 'Dịch vụ'}</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={[styles.catalogItemDesc, !isDark && { color: '#64748B' }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.catalogItemBottomRow}>
          <View>
            <Text style={[styles.catalogItemPrice, !isAvailable && { color: '#94A3B8' }]}>
              {priceFormatted}
            </Text>
            <Text style={{ fontSize: 10, color: isAvailable ? '#10B981' : '#EF4444', fontWeight: '800', marginTop: 1 }}>
              {isAvailable ? '● Đang phục vụ' : '● Tạm hết món'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Nút Toggle Còn món / Hết món */}
            <TouchableOpacity
              style={[
                styles.catalogToggleBtn,
                !isAvailable && styles.catalogToggleBtnInactive,
                !isDark && {
                  backgroundColor: isAvailable ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  borderColor: isAvailable ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                },
              ]}
              onPress={() => onToggleActive(item)}
              disabled={isToggling}
              activeOpacity={0.7}
            >
              {isToggling ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Ionicons
                    name={isAvailable ? 'pause-circle-outline' : 'play-circle-outline'}
                    size={13}
                    color={isAvailable ? '#DC2626' : '#059669'}
                    style={{ marginRight: 3 }}
                  />
                  <Text
                    style={[
                      styles.catalogToggleBtnText,
                      { color: isAvailable ? '#DC2626' : '#059669' },
                    ]}
                  >
                    {isAvailable ? 'Báo hết' : 'Mở lại'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Nút Gọi món */}
            <TouchableOpacity
              style={[
                styles.catalogOrderBtn,
                !isAvailable && { opacity: 0.45 },
              ]}
              onPress={handleOrderPress}
              activeOpacity={0.8}
            >
              <Ionicons name="cart" size={13} color="#0A0F1D" style={{ marginRight: 4 }} />
              <Text style={styles.catalogOrderBtnText}>Gọi món</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
});
