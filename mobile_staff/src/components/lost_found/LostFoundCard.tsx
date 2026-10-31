import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';


export interface LostFoundItem {
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
};

export interface LostFoundCardProps {
  item: LostFoundItem;
  isLoading: boolean;
  onPreviewImage: (url: string | null) => void;
  onCallPhone: (phone: string) => void;
  onMarkContacted: (item: LostFoundItem) => void;
  onOpenReturn: (item: LostFoundItem) => void;
}

export const LostFoundCard: React.FC<LostFoundCardProps> = React.memo(({
  item,
  isLoading,
  onPreviewImage,
  onCallPhone,
  onMarkContacted,
  onOpenReturn,
}) => {
  const { isDark } = useAppTheme();
  const isStored = item.status === 'stored';
  const isContacted = item.status === 'contacted';
  const isReturned = item.status === 'returned';

  const getStatusStyle = () => {
    if (isStored) {
      return {
        bg: isDark ? Palette.gold.subtle : 'rgba(245, 158, 11, 0.12)',
        border: isDark ? Palette.gold.border : 'rgba(245, 158, 11, 0.35)',
        text: isDark ? Palette.gold.light : '#D97706',
        label: 'Đang lưu kho',
        icon: 'archive' as const,
      };
    }
    if (isContacted) {
      return {
        bg: isDark ? Palette.sky.subtle : 'rgba(56, 189, 248, 0.12)',
        border: isDark ? Palette.sky.border : 'rgba(56, 189, 248, 0.35)',
        text: isDark ? Palette.sky.main : '#0284C7',
        label: 'Đã báo khách',
        icon: 'call' as const,
      };
    }
    return {
      bg: isDark ? Palette.emerald.subtle : 'rgba(16, 185, 129, 0.12)',
      border: isDark ? Palette.emerald.border : 'rgba(16, 185, 129, 0.35)',
      text: isDark ? Palette.emerald.light : '#059669',
      label: 'Đã trao trả',
      icon: 'checkmark-circle' as const,
    };
  };

  const statusObj = getStatusStyle();

  return (
    <View
      style={[
        styles.card,
        !isDark && {
          backgroundColor: '#FFFFFF',
          borderColor: isStored ? 'rgba(245, 158, 11, 0.35)' : '#E2E8F0',
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
        (isStored || isContacted) && isDark && styles.cardStored,
      ]}
    >
      {/* Header thẻ */}
      <View style={styles.cardHeader}>
        <View style={[styles.locationTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
          <Ionicons name="location" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
          <Text style={[styles.locationTagText, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
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
            onPress={() => onPreviewImage(item.image_url || item.image || null)}
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
          <View style={[styles.itemIconBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
            <Ionicons name="cube" size={20} color="#F59E0B" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, !isDark && { color: '#0F172A' }]}>{item.item_name}</Text>
          <Text style={[styles.trackingCode, !isDark && { color: '#64748B' }]}>Mã: #{item.tracking_code}</Text>
          {item.room_number ? (
            <Text style={[styles.roomLinkText, !isDark && { color: '#0284C7' }]}>Phòng liên quan: P.{item.room_number}</Text>
          ) : null}
        </View>
      </View>

      {/* Mô tả đặc điểm */}
      {item.description ? (
        <View style={[styles.descBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
          <Text style={[styles.descText, !isDark && { color: '#334155' }]}>Chi tiết: {item.description}</Text>
        </View>
      ) : null}

      {/* Thông tin khách hàng liên quan nếu có */}
      {item.guest_name ? (
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, !isDark && { color: '#64748B' }]}>Khách liên quan:</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={[styles.infoValue, { color: '#0284C7', fontWeight: '700' }]}>
              {item.guest_name}
            </Text>
            {item.guest_phone ? (
              <TouchableOpacity
                style={[styles.callGuestMiniBtn, !isDark && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}
                onPress={() => onCallPhone(item.guest_phone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={11} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 3 }} />
                <Text style={[styles.callGuestMiniText, !isDark && { color: '#059669' }]}>{item.guest_phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Thông tin lưu kho & Người nhặt */}
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, !isDark && { color: '#64748B' }]}>Kho cất giữ:</Text>
        <Text style={[styles.infoValue, !isDark && { color: '#334155' }]}>{item.storage_location || 'Két an toàn Lễ tân'}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, !isDark && { color: '#64748B' }]}>Phát hiện:</Text>
        <Text style={[styles.infoValue, !isDark && { color: '#334155' }]}>
          {new Date(item.found_date).toLocaleDateString('vi-VN')} • {item.finder_name || 'Buồng phòng'}
        </Text>
      </View>

      {/* Nút hành động */}
      {(isStored || isContacted) ? (
        <View style={styles.actionRowLF}>
          {isStored && (
            <TouchableOpacity
              style={[
                styles.contactActionBtn,
                !isDark && { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
                isLoading && { opacity: 0.65 },
              ]}
              onPress={() => onMarkContacted(item)}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#0284C7" />
              ) : (
                <>
                  <Ionicons name="call-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text style={[styles.contactActionBtnText, !isDark && { color: '#0284C7' }]}>Đã gọi khách</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.returnActionBtn}
            onPress={() => onOpenReturn(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="hand-left" size={14} color="#0A0F1D" style={{ marginRight: 5 }} />
            <Text style={styles.returnActionBtnText}>BÀN GIAO TRẢ KHÁCH</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={[
            styles.returnedInfoBox,
            !isDark && {
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
            },
          ]}
        >
          <Ionicons name="shield-checkmark" size={14} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 6 }} />
          <Text style={[styles.returnedInfoText, !isDark && { color: '#059669' }]}>
            Đã trao trả cho: {item.returned_to || 'Khách hàng'}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
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
    backgroundColor: '#13192B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    maxWidth: '65%',
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
    marginBottom: 12,
  },
  itemThumbWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  itemThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(10, 15, 29, 0.8)',
    borderRadius: 4,
    padding: 2,
  },
  itemIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  roomLinkText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
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
    lineHeight: 17,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  callGuestMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  callGuestMiniText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
  },
  actionRowLF: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  contactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  contactActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#38BDF8',
  },
  returnActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 9,
    borderRadius: 10,
  },
  returnActionBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.3,
  },
  returnedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  returnedInfoText: {
    fontSize: 11.5,
    color: '#34D399',
    fontWeight: '700',
  },
});
