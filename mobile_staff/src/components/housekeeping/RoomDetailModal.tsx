import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { styles } from './styles';
import { getStatusConfig } from './RoomCard';
import type { RoomItem } from './types';
import { useAppTheme } from '../../contexts/ThemeContext';

interface RoomDetailModalProps {
  visible: boolean;
  room: RoomItem | null;
  onClose: () => void;
  canMarkCleaned: boolean;
  canAccessMinibar: boolean;
  canReportLostItem: boolean;
  canReportMaintenance: boolean;
  isTechnician: boolean;
  isManagerOrAdmin: boolean;
  onToggleCleaning: (room: RoomItem) => void;
  onOpenMinibar: (room: RoomItem) => void;
  onOpenLostFound: (room: RoomItem) => void;
  onOpenBreakdown: (room: RoomItem) => void;
  onOpenCrm: (guestId: number) => void;
  onNavigateServices: () => void;
  onNavigateTransport: () => void;
  onNavigateMaintenance: () => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = React.memo(({
  visible,
  room,
  onClose,
  canMarkCleaned,
  canAccessMinibar,
  canReportLostItem,
  canReportMaintenance,
  isTechnician,
  isManagerOrAdmin,
  onToggleCleaning,
  onOpenMinibar,
  onOpenLostFound,
  onOpenBreakdown,
  onOpenCrm,
  onNavigateServices,
  onNavigateTransport,
  onNavigateMaintenance,
}) => {
  if (!room) return null;

  const { isDark } = useAppTheme();
  const config = getStatusConfig(room.status, isDark);
  const bk = room.current_booking || room.recent_booking;
  const isInspectReq = room.latest_minibar_check?.status === 'requested';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.detailModalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
        <View
          style={[
            styles.detailModalCard,
            !isDark && {
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
              shadowColor: '#64748B',
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={[styles.detailHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.detailRoomTitle, !isDark && { color: '#0F172A' }]}>Phòng {room.room_number}</Text>
                  <View
                    style={[
                      styles.detailStatusBadge,
                      { backgroundColor: config.bg, borderColor: config.border },
                    ]}
                  >
                    <View style={[styles.pulseDot, { backgroundColor: config.dot }]} />
                    <Text style={[styles.detailStatusText, { color: config.text }]}>
                      {config.label}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.detailRoomSub, !isDark && { color: '#64748B' }]}>
                  Tầng {room.floor} • {room.category_name || 'Phòng tiêu chuẩn'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.detailCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
              </TouchableOpacity>
            </View>

            {/* Banner Lễ tân cần kiểm check-out (Chỉ Buồng phòng & Quản lý) */}
            {canAccessMinibar && isInspectReq && (
              <View style={styles.detailAlertBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="warning" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.detailAlertTitle}>LỄ TÂN ĐỢI KIỂM CHECK-OUT</Text>
                </View>
                <Text style={styles.detailAlertSub}>
                  Khách đang tại quầy lễ tân chờ trả phòng. Vui lòng kiểm tra minibar và hiện trạng đồ đạc ngay.
                </Text>
                <TouchableOpacity
                  style={styles.detailAlertActionBtn}
                  onPress={() => {
                    onClose();
                    onOpenMinibar(room);
                  }}
                >
                  <Ionicons name="wine" size={14} color="#0A0F1D" style={{ marginRight: 4 }} />
                  <Text style={styles.detailAlertActionText}>KIỂM TRA MINIBAR NGAY</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Thông tin khách & Lưu trú */}
            <View style={[styles.detailSectionBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <View style={styles.detailSectionHeader}>
                <Ionicons name="person-circle-outline" size={18} color="#0284C7" />
                <Text style={[styles.detailSectionTitle, !isDark && { color: '#0F172A' }]}>Thông tin lưu trú</Text>
                {bk?.status_display ? (
                  <View style={[styles.detailBkStatusBadge, !isDark && { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                    <Text style={[styles.detailBkStatusText, !isDark && { color: '#0284C7' }]}>{bk.status_display}</Text>
                  </View>
                ) : null}
              </View>

              {bk ? (
                <View style={styles.detailInfoGrid}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Họ tên khách:</Text>
                    <Text style={[styles.detailValueBold, !isDark && { color: '#0F172A' }]}>{bk.guest_name || 'Khách lưu trú'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Mã đặt phòng:</Text>
                    <Text style={[styles.detailValueCode, !isDark && { color: '#D97706' }]}>#{bk.booking_code}</Text>
                  </View>
                  {bk.guest_phone ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Số điện thoại:</Text>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => Linking.openURL(`tel:${bk.guest_phone}`)}
                      >
                        <Ionicons name="call" size={13} color="#059669" style={{ marginRight: 4 }} />
                        <Text style={[styles.detailValueBold, { color: '#059669' }]}>
                          {bk.guest_phone}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {bk.check_in_date ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Nhận phòng:</Text>
                      <Text style={[styles.detailValue, !isDark && { color: '#334155' }]}>{bk.check_in_date}</Text>
                    </View>
                  ) : null}
                  {bk.check_out_date ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Trả phòng:</Text>
                      <Text style={[styles.detailValue, !isDark && { color: '#334155' }]}>{bk.check_out_date}</Text>
                    </View>
                  ) : null}

                  {(bk.guest_id || (bk as any).guest) ? (
                    <TouchableOpacity
                      style={styles.detailCrmBtn}
                      onPress={() => {
                        const gid = bk.guest_id || (typeof (bk as any).guest === 'object' ? (bk as any).guest?.id : (bk as any).guest);
                        onClose();
                        onOpenCrm(gid);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Ionicons name="person-circle" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                      <Text style={styles.detailCrmBtnText}>Xem Hồ Sơ CRM & Lịch Sử Khách</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.detailEmptyText}>Hiện không có thông tin khách lưu trú.</Text>
              )}
            </View>

            {/* Sự cố kỹ thuật nếu có */}
            {room.active_maintenance && (
              <View
                style={[
                  styles.detailSectionBox,
                  { borderColor: 'rgba(239, 68, 68, 0.3)' },
                  !isDark && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                ]}
              >
                <View style={styles.detailSectionHeader}>
                  <Ionicons name="construct-outline" size={18} color="#EF4444" />
                  <Text style={[styles.detailSectionTitle, { color: '#EF4444' }]}>
                    Phiếu bảo trì đang xử lý
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Mã sự cố:</Text>
                  <Text style={[styles.detailValueCode, { color: '#DC2626' }]}>
                    #{room.active_maintenance.ticket_code}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Thiết bị:</Text>
                  <Text style={[styles.detailValueBold, !isDark && { color: '#0F172A' }]}>
                    {room.active_maintenance.equipment_name}
                  </Text>
                </View>
                {room.active_maintenance.description ? (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[styles.detailLabel, !isDark && { color: '#64748B' }]}>Mô tả lỗi:</Text>
                    <Text style={[styles.detailDescText, !isDark && { color: '#334155' }]}>
                      {room.active_maintenance.description}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Hành động nhanh theo phân quyền */}
            {room.status === 'maintenance' ? (
              <View
                style={[
                  styles.maintenanceIsolatedBox,
                  !isDark && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="construct" size={18} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={[styles.maintenanceIsolatedTitle, !isDark && { color: '#B45309' }]}>
                    Phòng đang cách ly sửa chữa 🛠️
                  </Text>
                </View>
                <Text style={[styles.maintenanceIsolatedDesc, !isDark && { color: '#78350F' }]}>
                  Thiết bị trong phòng đang được Đội Kỹ thuật khắc phục theo phiếu #{room.active_maintenance?.ticket_code || 'Bảo trì'}.
                  {isTechnician || isManagerOrAdmin
                    ? ' Bạn có thể chuyển sang tab Kỹ thuật để nghiệm thu hoặc hoàn tất sửa chữa.'
                    : ' Sau khi kỹ thuật viên sửa xong, phòng sẽ tự động chuyển sang "Đang dọn dẹp" để buồng phòng vào làm vệ sinh đón khách.'}
                </Text>

                {(isTechnician || isManagerOrAdmin) && (
                  <TouchableOpacity
                    style={styles.maintenanceGoBtn}
                    onPress={() => {
                      onClose();
                      onNavigateMaintenance();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="build" size={15} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.maintenanceGoBtnText}>Đi đến Phiếu bảo trì & Nghiệm thu 🛠️</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={[styles.detailActionsHeading, !isDark && { color: '#64748B' }]}>
                  {isTechnician
                    ? 'Thao tác cho Kỹ thuật viên'
                    : canMarkCleaned
                    ? 'Thao tác nhanh cho Buồng phòng'
                    : 'Thao tác cho Phục vụ phòng'}
                </Text>
                <View style={styles.detailActionsGrid}>
                  {/* 1. Nút Đổi trạng thái Dọn phòng: CHỈ HIỆN khi phòng đang 'cleaning' hoặc 'available' */}
                  {canMarkCleaned && (room.status === 'cleaning' || room.status === 'available') && (
                    <TouchableOpacity
                      style={[styles.detailActionBtn, { backgroundColor: config.actionBg }]}
                      onPress={() => {
                        onClose();
                        onToggleCleaning(room);
                      }}
                    >
                      <Ionicons
                        name={config.actionIcon as any}
                        size={18}
                        color={config.actionColor}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.detailActionBtnText, { color: config.actionColor }]}>
                        {config.actionText}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* 2. Kiểm Minibar: CHỈ khi phòng có khách (occupied) hoặc vừa trả phòng đang dọn (cleaning) */}
                  {canAccessMinibar && (room.status === 'occupied' || room.status === 'cleaning') && (
                    <TouchableOpacity
                      style={[
                        styles.detailToolBtn,
                        !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      ]}
                      onPress={() => {
                        onClose();
                        onOpenMinibar(room);
                      }}
                    >
                      <Ionicons name="wine" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailToolBtnText, { color: '#F59E0B' }]}>Kiểm Minibar</Text>
                    </TouchableOpacity>
                  )}

                  {/* 3. Thêm dịch vụ & Đặt xe: CHỈ cho phòng có khách và KHÔNG PHẢI Kỹ thuật */}
                  {!isTechnician && room.status === 'occupied' && (
                    <TouchableOpacity
                      style={[
                        styles.detailToolBtn,
                        { borderColor: 'rgba(56, 189, 248, 0.4)', backgroundColor: 'rgba(56, 189, 248, 0.08)' },
                      ]}
                      onPress={() => {
                        onClose();
                        onNavigateServices();
                      }}
                    >
                      <Ionicons name="restaurant" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailToolBtnText, { color: '#0284C7' }]}>Thêm dịch vụ & Gọi món 🍽️</Text>
                    </TouchableOpacity>
                  )}

                  {!isTechnician && room.status === 'occupied' && (
                    <TouchableOpacity
                      style={[
                        styles.detailToolBtn,
                        { borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.08)' },
                      ]}
                      onPress={() => {
                        onClose();
                        onNavigateTransport();
                      }}
                    >
                      <Ionicons name="car-sport" size={16} color="#D97706" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailToolBtnText, { color: '#D97706' }]}>Đặt xe đưa đón 🚗</Text>
                    </TouchableOpacity>
                  )}

                  {/* 4. Báo đồ bỏ quên: CHỈ cho phòng có khách hoặc đang dọn (tránh phòng trống/bảo trì) */}
                  {canReportLostItem && (room.status === 'occupied' || room.status === 'cleaning') && (
                    <TouchableOpacity
                      style={[
                        styles.detailToolBtn,
                        !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      ]}
                      onPress={() => {
                        onClose();
                        onOpenLostFound(room);
                      }}
                    >
                      <Ionicons name="briefcase" size={16} color="#8B5CF6" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailToolBtnText, { color: '#8B5CF6' }]}>Báo đồ bỏ quên</Text>
                    </TouchableOpacity>
                  )}

                  {/* 5. Báo hỏng thiết bị: Phòng chưa ở trạng thái Bảo trì */}
                  {canReportMaintenance && (
                    <TouchableOpacity
                      style={[
                        styles.detailToolBtn,
                        !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      ]}
                      onPress={() => {
                        onClose();
                        onOpenBreakdown(room);
                      }}
                    >
                      <Ionicons name="construct" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailToolBtnText, { color: '#EF4444' }]}>Báo hỏng thiết bị</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
