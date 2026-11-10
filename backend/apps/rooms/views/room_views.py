"""Sơ đồ phòng: danh sách, chi tiết, trạng thái, dọn phòng."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Count, Avg, Prefetch
from django.utils import timezone
from ...users.models import log_action, User
from ...users.views import check_role_permission
from ...bookings.models import Booking
from ...notifications.models import Notification
from ..models import Room, RoomCategory, MaintenanceTicket, MinibarCheck
from ..serializers import RoomSerializer, RoomCategorySerializer, RoomStatusUpdateSerializer
from .permissions import IsHotelStaffOrAdmin


# =========================================================================
# 2. API DANH SÁCH & TẠO MỚI PHÒNG THỰC TẾ (Rooms Board)
# =========================================================================

class AdminRoomListCreateView(APIView):
    permission_classes = [IsHotelStaffOrAdmin]

    def get(self, request):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'read')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xem sơ đồ phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        queryset = Room.objects.select_related('category').prefetch_related(
            'category__images',
            'category__amenities',
            'category__rooms',
            Prefetch(
                'bookings',
                queryset=Booking.objects.filter(status__in=['checked_in', 'completed']).select_related('guest', 'guest__guest_profile', 'guest__current_tier', 'category').order_by('-updated_at', '-id')
            ),
            Prefetch(
                'maintenance_tickets',
                queryset=MaintenanceTicket.objects.filter(status='fixing').select_related('room', 'booking', 'booking__guest', 'technician', 'created_by')
            ),
            Prefetch(
                'minibar_checks',
                queryset=MinibarCheck.objects.select_related('inspector', 'requested_by').order_by('-created_at')
            )
        ).all()

        # 1. Tìm kiếm theo số phòng hoặc tên loại phòng
        q = request.query_params.get('q', '').strip()
        if q:
            queryset = queryset.filter(
                Q(room_number__icontains=q) |
                Q(category__name__icontains=q)
            )

        # 2. Lọc theo Tầng (Floor)
        floor = request.query_params.get('floor')
        if floor and floor != 'all':
            try:
                queryset = queryset.filter(floor=int(floor))
            except ValueError:
                pass

        # 3. Lọc theo Trạng thái (Status)
        room_status = request.query_params.get('status')
        if room_status and room_status != 'all':
            queryset = queryset.filter(status=room_status)

        # 4. Lọc theo Loại phòng (Category)
        category_id = request.query_params.get('category')
        if category_id and category_id != 'all':
            try:
                queryset = queryset.filter(category_id=int(category_id))
            except ValueError:
                pass

        # Sắp xếp theo tầng tăng dần, số phòng tăng dần
        queryset = queryset.order_by('floor', 'room_number')

        # Thống kê toàn khách sạn (không bị ảnh hưởng bởi bộ lọc tìm kiếm)
        all_rooms = Room.objects.all()
        total_rooms = all_rooms.count()
        available_count = all_rooms.filter(status='available').count()
        occupied_count = all_rooms.filter(status='occupied').count()
        cleaning_count = all_rooms.filter(status='cleaning').count()
        maintenance_count = all_rooms.filter(status='maintenance').count()

        occupancy_rate = 0.0
        if total_rooms > 0:
            occupancy_rate = round((occupied_count / total_rooms) * 100, 1)

        # Danh sách tất cả các tầng hiện có trong khách sạn
        floors = list(
            Room.objects.values_list('floor', flat=True).distinct().order_by('floor')
        )

        # Danh sách categories để frontend render dropdown (đã prefetch tránh N+1)
        categories = RoomCategory.objects.prefetch_related('images', 'amenities', 'rooms').annotate(
            avg_rating=Avg('reviews__overall_rating', filter=Q(reviews__is_visible=True)),
            total_reviews=Count('reviews', filter=Q(reviews__is_visible=True))
        ).order_by('base_price')

        serializer = RoomSerializer(queryset, many=True)

        return Response({
            'success': True,
            'count': queryset.count(),
            'rooms': serializer.data,
            'floors': floors,
            'categories': RoomCategorySerializer(categories, many=True).data,
            'stats': {
                'total': total_rooms,
                'available': available_count,
                'occupied': occupied_count,
                'cleaning': cleaning_count,
                'maintenance': maintenance_count,
                'occupancy_rate': occupancy_rate,
            }
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'create')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thêm phòng mới vào sơ đồ (Yêu cầu quyền Thêm mới).'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = RoomSerializer(data=request.data)
        if serializer.is_valid():
            room = serializer.save()

            log_action(
                user=request.user,
                action='CREATE',
                module='ROOM',
                description=f'Thêm phòng mới {room.room_number} (Tầng {room.floor}, Hạng phòng: {room.category.name if room.category else "Chưa chọn"})',
                request=request
            )

            return Response({
                'success': True,
                'message': f'Thêm phòng {room.room_number} (Tầng {room.floor}) thành công!',
                'room': RoomSerializer(room).data
            }, status=status.HTTP_201_CREATED)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# =========================================================================
# 3. API CHI TIẾT, CẬP NHẬT & XÓA PHÒNG
# =========================================================================

class AdminRoomDetailView(APIView):
    permission_classes = [IsHotelStaffOrAdmin]

    def get_object(self, pk):
        try:
            return Room.objects.select_related('category').get(pk=pk)
        except Room.DoesNotExist:
            return None

    def get(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'read')):
            return Response({'success': False, 'message': 'Bạn không có quyền xem thông tin phòng.'}, status=status.HTTP_403_FORBIDDEN)

        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'success': True, 'room': RoomSerializer(room).data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền chỉnh sửa thông tin phòng (Yêu cầu quyền Cập nhật).'
            }, status=status.HTTP_403_FORBIDDEN)

        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RoomSerializer(room, data=request.data, partial=True)
        if serializer.is_valid():
            updated_room = serializer.save()

            log_action(
                user=request.user,
                action='UPDATE',
                module='ROOM',
                description=f'Cập nhật thông tin phòng {updated_room.room_number}',
                request=request
            )

            return Response({
                'success': True,
                'message': f'Cập nhật thông tin phòng {updated_room.room_number} thành công!',
                'room': RoomSerializer(updated_room).data
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'delete')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xóa phòng khỏi sơ đồ (Yêu cầu quyền Xóa).'
            }, status=status.HTTP_403_FORBIDDEN)

        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng cần xóa.'}, status=status.HTTP_404_NOT_FOUND)

        room_num = room.room_number
        room.delete()

        log_action(
            user=request.user,
            action='DELETE',
            module='ROOM',
            description=f'Xóa phòng {room_num} khỏi sơ đồ phòng',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đã xóa phòng {room_num} khỏi sơ đồ phòng khách sạn thành công.'
        }, status=status.HTTP_200_OK)


# =========================================================================
# 4. API THAY ĐỔI NHANH TRẠNG THÁI PHÒNG (Cho Lễ tân & Buồng phòng)
# =========================================================================

class AdminRoomStatusUpdateView(APIView):
    """
    Endpoint tối ưu tốc độ cho Lễ tân / Buồng phòng bấm nút nhanh đổi trạng thái:
    available <-> occupied <-> cleaning <-> maintenance
    """
    permission_classes = [IsHotelStaffOrAdmin]

    def patch(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền cập nhật trạng thái phòng (Yêu cầu quyền Cập nhật).'
            }, status=status.HTTP_403_FORBIDDEN)

        user_role = getattr(request.user, 'role', '')
        if user_role in ['technician', 'service_staff']:
            return Response({
                'success': False,
                'message': 'Vai trò của bạn không được phép thay đổi trực tiếp trạng thái phòng. Kỹ thuật viên vui lòng thao tác qua phiếu Bảo trì.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            room = Room.objects.select_related('category').get(pk=pk)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        old_status = room.status
        active_booking = room.bookings.filter(status='checked_in').select_related('guest').first()

        update_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        requested_status = update_data.get('status')

        if user_role == 'housekeeper':
            # Buồng phòng được phép:
            # 1. Chuyển phòng sang 'cleaning' hoặc 'available' (đối với phòng trống)
            # 2. Chuyển phòng sang 'occupied' (khi hoàn tất dọn phòng đang có khách ở / sau bảo trì)
            allowed_statuses = ['available', 'cleaning']
            if active_booking and old_status in ['cleaning', 'maintenance']:
                allowed_statuses.append('occupied')

            if requested_status not in allowed_statuses:
                return Response({
                    'success': False,
                    'message': 'Nhân viên buồng phòng chỉ được cập nhật trạng thái dọn dẹp phòng (Trống/Đang dọn).'
                }, status=status.HTTP_403_FORBIDDEN)

        # CHẶN LỄ TÂN TỰ Ý DUYỆT PHÒNG SẠCH: Chỉ Buồng phòng (housekeeper) hoặc Quản lý/Admin mới có quyền nghiệm thu dọn xong
        if user_role == 'receptionist' and old_status in ['cleaning', 'maintenance'] and requested_status == 'available':
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên Buồng phòng (Housekeeping) hoặc Quản lý mới có quyền xác nhận hoàn tất dọn dẹp phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        # CHỐT CHẶN STATE MACHINE (MAINTENANCE -> CLEANING):
        # 1. Không cho phép nhảy cóc trực tiếp từ 'maintenance' sang 'available' khi phòng không có khách lưu trú.
        #    Sau bảo trì bắt buộc phải qua bước 'cleaning' để Buồng phòng dọn vệ sinh và kiểm tra lại.
        if old_status == 'maintenance' and requested_status == 'available' and not active_booking:
            return Response({
                'success': False,
                'message': f'Phòng {room.room_number} đang ở trạng thái Bảo trì. Theo chuẩn vận hành 5 sao, sau khi sửa chữa xong phòng bắt buộc phải chuyển sang "Đang dọn dẹp" (Cleaning) để Buồng phòng vệ sinh trước khi mở bán.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Nếu phòng đang có phiếu bảo trì chưa hoàn tất (status='fixing'), không cho phép đổi trạng thái thoát khỏi 'maintenance' thủ công
        if old_status == 'maintenance' and requested_status != 'maintenance':
            has_fixing_ticket = room.maintenance_tickets.filter(status='fixing').exists()
            if has_fixing_ticket and not request.user.is_superuser and user_role not in ['admin', 'owner', 'manager']:
                return Response({
                    'success': False,
                    'message': f'Phòng {room.room_number} vẫn còn phiếu sự cố kỹ thuật đang xử lý. Vui lòng nghiệm thu hoàn tất hoặc hủy phiếu bảo trì trước khi đổi trạng thái phòng.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # NGHIỆP VỤ BẢO TRÌ & DỌN DẸP KHI PHÒNG ĐANG CÓ KHÁCH LƯU TRÚ:
        # Nếu phòng đang ở trạng thái 'cleaning' hoặc 'maintenance' và phòng có khách lưu trú (active_booking):
        # Khi Buồng phòng xác nhận dọn xong (requested_status là 'available' hoặc 'occupied'),
        # phòng PHẢI TỰ ĐỘNG CHUYỂN VỀ 'occupied' (Có khách) để khách tiếp tục sinh hoạt, KHÔNG chuyển sang 'available'.
        if active_booking and old_status in ['cleaning', 'maintenance']:
            if requested_status in ['available', 'occupied']:
                update_data['status'] = 'occupied'
                requested_status = 'occupied'
                room.is_cleaning_requested = False
                room.cleaning_request_note = ''
                room.cleaning_requested_at = None
                room.save(update_fields=['is_cleaning_requested', 'cleaning_request_note', 'cleaning_requested_at'])

        # CHẶN LỖI NGHIỆP VỤ: Không cho phép đổi trạng thái thủ công khi phòng đang có khách lưu trú
        # Bắt buộc phải qua quy trình "Trả phòng & Quyết toán" (Check-out) hoặc "Đổi phòng" (Room Move)
        if (old_status == 'occupied' or active_booking) and requested_status != 'occupied':
            bk_code = f" (#{active_booking.booking_code})" if active_booking else ""
            return Response({
                'success': False,
                'message': f'Phòng {room.room_number} hiện đang có khách lưu trú{bk_code}. Không thể đổi trạng thái trực tiếp. Vui lòng thực hiện thủ tục "Trả phòng & Quyết toán" hoặc "Đổi phòng" theo quy trình PMS.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # CHẶN TỰ Ý CHUYỂN SANG OCCUPIED: Muốn chuyển phòng sang 'occupied' bắt buộc phải qua quy trình Check-in có hồ sơ khách
        if requested_status == 'occupied' and not active_booking:
            return Response({
                'success': False,
                'message': f'Không thể tự ý chuyển phòng {room.room_number} sang "Có khách" bằng thao tác nhanh. Vui lòng dùng nút "Gán phòng & Check-in ngay" để tạo hồ sơ khách và lưu trú hợp lệ.'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = RoomStatusUpdateSerializer(room, data=update_data, partial=True)
        if serializer.is_valid():
            updated_room = serializer.save()
            new_status = updated_room.status
            all_rooms = Room.objects.all()
            available_count = all_rooms.filter(status='available').count()
            occupied_count = all_rooms.filter(status='occupied').count()
            cleaning_count = all_rooms.filter(status='cleaning').count()
            maintenance_count = all_rooms.filter(status='maintenance').count()
            total_rooms = all_rooms.count()
            occupancy_rate = round((occupied_count / total_rooms * 100), 1) if total_rooms > 0 else 0
            stats_data = {
                'total': total_rooms,
                'available': available_count,
                'occupied': occupied_count,
                'cleaning': cleaning_count,
                'maintenance': maintenance_count,
                'occupancy_rate': occupancy_rate,
            }

            # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
            log_action(
                user=request.user,
                action='UPDATE',
                module='ROOM',
                description=f"Cập nhật phòng {updated_room.room_number} sang trạng thái \"{updated_room.get_status_display()}\"",
                request=request
            )

            # 1. KHI BUỒNG PHÒNG DỌN XONG (cleaning -> available hoặc occupied khi có khách ở)
            if old_status == 'cleaning' and new_status in ['available', 'occupied']:
                try:
                    staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Nhân viên Buồng phòng"
                    recipients = User.objects.filter(
                        Q(role__in=['receptionist', 'admin']) | (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'housekeeper', 'technician', 'service_staff', 'cashier']))
                    ).distinct()
                    cat_name = updated_room.category.name if updated_room.category else 'Tiêu chuẩn'
                    
                    if active_booking:
                        guest_name = active_booking.guest.get_full_name() if active_booking.guest else active_booking.guest_name
                        notif_title = f"[Dọn phòng hoàn tất] Phòng {updated_room.room_number} đã dọn xong"
                        notif_message = (
                            f"Nhân viên ({staff_name}) đã hoàn tất dọn dẹp phòng {updated_room.room_number} ({cat_name}).\n"
                            f"• Phòng đang có khách lưu trú: {guest_name} (#{active_booking.booking_code})\n"
                            f"• Trạng thái hiện tại: Có khách (Occupied) - Tiếp tục phục vụ khách."
                        )
                    else:
                        notif_title = f"[Phòng sẵn sàng] Phòng {updated_room.room_number} đã dọn xong"
                        notif_message = (
                            f"Nhân viên ({staff_name}) đã hoàn tất dọn dẹp phòng {updated_room.room_number} ({cat_name}).\n"
                            f"• Trạng thái hiện tại: Trống (Sẵn sàng mở bán)\n"
                            f"Lễ tân có thể tiến hành Gán phòng hoặc Check-in đón khách ngay."
                        )
                    notifs = [
                        Notification(
                            recipient=r,
                            title=notif_title,
                            message=notif_message,
                            notification_type='room',
                            action_url='/admin/rooms',
                            priority='normal'
                        )
                        for r in recipients
                    ]
                    if notifs:
                        Notification.objects.bulk_create(notifs)
                except Exception:
                    pass

            # 2. KHI YÊU CẦU DỌN DẸP (trạng thái khác -> cleaning): Gửi thông báo đến Buồng phòng
            elif old_status != 'cleaning' and new_status == 'cleaning':
                try:
                    staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
                    recipients = User.objects.filter(
                        Q(role__in=['housekeeper', 'admin']) | (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'technician', 'service_staff', 'cashier']))
                    ).distinct()
                    cat_name = updated_room.category.name if updated_room.category else 'Tiêu chuẩn'
                    notif_title = f"[YÊU CẦU DỌN PHÒNG] Phòng {updated_room.room_number} cần dọn dẹp!"
                    notif_message = (
                        f"Phòng {updated_room.room_number} ({cat_name}) vừa được chuyển sang 'Đang dọn dẹp' (Cleaning).\n"
                        f"• Người yêu cầu: {staff_name}\n"
                        f"Kính mời bộ phận Buồng phòng tiến hành vệ sinh và thay ga gối."
                    )
                    notifs = [
                        Notification(
                            recipient=r,
                            title=notif_title,
                            message=notif_message,
                            notification_type='room',
                            action_url='/admin/rooms',
                            priority='normal'
                        )
                        for r in recipients
                    ]
                    if notifs:
                        Notification.objects.bulk_create(notifs)
                except Exception:
                    pass

            return Response({
                'success': True,
                'message': f'Đã đổi trạng thái phòng {updated_room.room_number} thành "{updated_room.get_status_display()}".',
                'room': RoomSerializer(updated_room).data,
                'stats': stats_data,
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AdminRoomRequestCleaningView(APIView):
    """
    Tiếp nhận yêu cầu dọn dẹp phòng lưu trú (Make-up room / Stay-over cleaning) cho phòng đang có khách.
    Trạng thái phòng vẫn giữ nguyên 'occupied'.
    """
    permission_classes = [IsHotelStaffOrAdmin]

    def post(self, request, pk):
        try:
            room = Room.objects.select_related('category').get(pk=pk)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        active_booking = room.bookings.filter(status='checked_in').select_related('guest').first()
        if not active_booking and room.status != 'occupied':
            return Response({
                'success': False,
                'message': f'Phòng {room.room_number} hiện không có khách đang lưu trú. Yêu cầu dọn phòng lưu trú chỉ áp dụng cho phòng đang có khách.'
            }, status=status.HTTP_400_BAD_REQUEST)

        note = request.data.get('note', '').strip() or 'Khách yêu cầu dọn phòng lưu trú (Make-up room)'
        room.is_cleaning_requested = True
        room.cleaning_request_note = note
        room.cleaning_requested_at = timezone.now()
        room.save(update_fields=['is_cleaning_requested', 'cleaning_request_note', 'cleaning_requested_at'])

        # Gửi thông báo đến nhân viên Buồng phòng & Quản lý
        try:
            staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
            housekeepers = User.objects.filter(
                Q(role__in=['housekeeper', 'manager', 'admin']) | Q(is_superuser=True)
            ).distinct()
            guest_str = active_booking.guest.get_full_name() if active_booking and active_booking.guest else (active_booking.guest_name if active_booking else "Khách lưu trú")
            notifs = [
                Notification(
                    recipient=u,
                    title=f"[YÊU CẦU DỌN PHÒNG] Phòng {room.room_number}",
                    message=f"Phòng {room.room_number} (Khách: {guest_str}) vừa yêu cầu dọn phòng lưu trú.\n• Ghi chú: {note}\n• Người tiếp nhận: {staff_name}",
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='high'
                )
                for u in housekeepers
            ]
            Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Tiếp nhận yêu cầu dọn phòng lưu trú cho phòng {room.room_number}: {note}",
            request=request
        )

        serializer = RoomSerializer(room)
        return Response({
            'success': True,
            'message': f'Đã tiếp nhận yêu cầu dọn phòng {room.room_number} thành công! Hệ thống đã gửi thông báo đến bộ phận Buồng phòng.',
            'room': serializer.data
        })


class AdminRoomCompleteCleaningView(APIView):
    """
    Xác nhận hoàn tất dọn dẹp phòng lưu trú (Make-up room).
    Phòng vẫn tiếp tục giữ nguyên trạng thái 'occupied'.
    """
    permission_classes = [IsHotelStaffOrAdmin]

    def post(self, request, pk):
        user = request.user
        user_role = getattr(user, 'role', '')
        allowed_roles = ['housekeeper', 'manager', 'admin', 'owner']
        if not (user.is_authenticated and (user.is_superuser or user_role in allowed_roles)):
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên Buồng phòng (Housekeeper) hoặc Quản lý mới có quyền xác nhận hoàn tất dọn dẹp phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            room = Room.objects.select_related('category').get(pk=pk)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        active_booking = room.bookings.filter(status='checked_in').select_related('guest').first()
        room.is_cleaning_requested = False
        room.cleaning_request_note = ''
        room.cleaning_requested_at = None
        if room.status == 'cleaning':
            room.status = 'occupied' if active_booking else 'available'
            room.save(update_fields=['status', 'is_cleaning_requested', 'cleaning_request_note', 'cleaning_requested_at'])
        else:
            room.save(update_fields=['is_cleaning_requested', 'cleaning_request_note', 'cleaning_requested_at'])

        # Gửi thông báo đến Lễ tân & Quản lý
        try:
            staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Nhân viên Buồng phòng"
            receptionists = User.objects.filter(
                Q(role__in=['receptionist', 'manager', 'admin']) | Q(is_superuser=True)
            ).distinct()
            guest_str = active_booking.guest.get_full_name() if active_booking and active_booking.guest else (active_booking.guest_name if active_booking else "Khách lưu trú")
            notifs = [
                Notification(
                    recipient=u,
                    title=f"[DỌN PHÒNG XONG] Phòng {room.room_number}",
                    message=f"Nhân viên ({staff_name}) đã hoàn tất dọn phòng lưu trú cho Phòng {room.room_number} (Khách: {guest_str}). Phòng tiếp tục ở trạng thái Có khách.",
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for u in receptionists
            ]
            Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Xác nhận hoàn tất dọn phòng lưu trú cho phòng {room.room_number}",
            request=request
        )

        serializer = RoomSerializer(room)
        return Response({
            'success': True,
            'message': f'Phòng {room.room_number} đã được dọn dẹp sạch sẽ! Trạng thái phòng vẫn tiếp tục "Có khách".',
            'room': serializer.data
        })
