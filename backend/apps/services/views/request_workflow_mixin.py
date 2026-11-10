"""Mixin: kanban, thông báo nhân viên, nhận việc, phân công cho phiếu yêu cầu dịch vụ."""
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ...users.models import log_action


class ServiceRequestWorkflowMixin:
    """Mixin: kanban, thông báo nhân viên, nhận việc, phân công."""


    @action(detail=False, methods=['get'], url_path='kanban')
    def kanban(self, request):
        """
        API chuyên biệt cung cấp dữ liệu định dạng sẵn cho Kanban Board (3 cột chính)
        GET /api/services/requests/kanban/
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        all_items = serializer.data

        kanban_data = {
            'pending': [item for item in all_items if item['status'] == 'pending'],
            'in_progress': [item for item in all_items if item['status'] == 'in_progress'],
            'delivering': [item for item in all_items if item['status'] == 'delivering'],
            'completed': [item for item in all_items if item['status'] == 'completed'],
            'cancelled': [item for item in all_items if item['status'] == 'cancelled'],
            'stats': {
                'total': len(all_items),
                'pending_count': len([i for i in all_items if i['status'] == 'pending']),
                'in_progress_count': len([i for i in all_items if i['status'] == 'in_progress']),
                'delivering_count': len([i for i in all_items if i['status'] == 'delivering']),
                'completed_count': len([i for i in all_items if i['status'] == 'completed']),
                'total_revenue': sum(float(i['total_price'] or 0) for i in all_items if i['status'] == 'completed')
            }
        }

        return Response({
            'success': True,
            'kanban': kanban_data,
            'data': kanban_data
        }, status=status.HTTP_200_OK)


    @action(detail=True, methods=['post'], url_path='notify-staff')
    def notify_staff(self, request, pk=None):
        """
        Lễ tân phát tín hiệu chuông báo bộ phận F&B / Spa chuẩn bị phục vụ khi khách Check-in.
        GIỮ NGUYÊN trạng thái 'pending' để nhân viên F&B/Spa tự tiếp nhận trên Kanban.
        Có thể cập nhật thời gian hẹn phục vụ (request_time) nếu khách hẹn giờ (ví dụ: 1 tiếng nữa).
        """
        user = request.user
        if not (user.is_authenticated and (user.is_staff or user.is_superuser or getattr(user, 'role', '') != 'guest')):
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên khách sạn mới có quyền phát chuông điều phối dịch vụ.'
            }, status=status.HTTP_403_FORBIDDEN)
        service_req = self.get_object()
        booking = service_req.booking
        guest_name = ''
        if booking:
            try:
                primary_guest = booking.guests.filter(is_primary=True).first() or booking.guests.first()
                if primary_guest and primary_guest.full_name:
                    guest_name = primary_guest.full_name.strip()
            except Exception:
                pass
            if not guest_name and booking.guest:
                guest_name = (booking.guest.get_full_name().strip() or f"{booking.guest.first_name or ''} {booking.guest.last_name or ''}".strip()) or booking.guest.username
        if not guest_name:
            guest_name = "Khách lưu trú"
        room_label = (booking.room.room_number if booking and booking.room else None) or \
                     (booking.category.name if booking and booking.category else "Chưa xếp phòng")
        service_name = service_req.service.name if service_req.service else "Dịch vụ"

        # Cập nhật thời gian hẹn phục vụ nếu Lễ tân truyền lên
        req_time_str = request.data.get('request_time')
        is_scheduled_param = request.data.get('is_scheduled', False)
        update_fields = []
        if req_time_str:
            try:
                from django.utils.dateparse import parse_datetime
                parsed_dt = parse_datetime(req_time_str)
                if parsed_dt:
                    if timezone.is_naive(parsed_dt):
                        parsed_dt = timezone.make_aware(parsed_dt)
                    service_req.request_time = parsed_dt
                    update_fields.append('request_time')
            except Exception as e:
                print(f"Lỗi parse request_time: {e}")

        service_req.is_scheduled = bool(is_scheduled_param)
        update_fields.append('is_scheduled')

        schedule_label = request.data.get('schedule_label', '')
        if schedule_label and 'note' not in update_fields:
            existing_note = service_req.note or ''
            if schedule_label not in existing_note:
                service_req.note = f"{existing_note} [{schedule_label}]".strip()
                update_fields.append('note')

        if update_fields:
            update_fields.append('updated_at')
            service_req.save(update_fields=list(set(update_fields)))
            service_req.refresh_from_db()

        # Soạn nội dung thông báo kèm thời gian hẹn (chỉ khi có hẹn giờ)
        if service_req.is_scheduled and service_req.request_time:
            local_time = timezone.localtime(service_req.request_time)
            time_display = local_time.strftime('%H:%M %d/%m/%Y')
            time_notice = f" ⏰ Khách hẹn phục vụ lúc: {time_display}."
        else:
            time_notice = " (Khách cần phục vụ ngay)"

        try:
            from ...notifications.signals import get_staff_and_admin_users, get_service_category_type
            from ...notifications.models import Notification

            category_name = (service_req.service.category.name if service_req.service and service_req.service.category else "") or ""
            cat_type = get_service_category_type(service_name, category_name)

            if cat_type == 'fnb':
                dept_name = "Bếp / F&B"
                dept_title = f"Báo Bếp/F&B chuẩn bị món: Phòng {room_label}"
                dept_message = (
                    f"Khách phòng {room_label} ({guest_name}) đã nhận phòng. "
                    f"Món ăn / Đồ uống: \"{service_name}\" (SL: {service_req.quantity})."
                    f"{time_notice} "
                    f"Vui lòng tiếp nhận và chế biến đúng giờ trên Kanban!"
                )
            elif cat_type == 'transport':
                dept_name = "Điều vận / Đội xe"
                dept_title = f"Báo Điều vận sắp xếp xe: Phòng {room_label}"
                dept_message = (
                    f"Khách phòng {room_label} ({guest_name}) đã nhận phòng. "
                    f"Dịch vụ đưa đón: \"{service_name}\" (SL: {service_req.quantity})."
                    f"{time_notice} "
                    f"Vui lòng điều phối phương tiện và tài xế sẵn sàng!"
                )
            elif cat_type == 'spa':
                dept_name = "Spa & Trị liệu"
                dept_title = f"Báo Spa chuẩn bị liệu trình: Phòng {room_label}"
                dept_message = (
                    f"Khách phòng {room_label} ({guest_name}) đã nhận phòng. "
                    f"Liệu trình Spa: \"{service_name}\" (SL: {service_req.quantity})."
                    f"{time_notice} "
                    f"Vui lòng chuẩn bị phòng trị liệu và kỹ thuật viên!"
                )
            elif cat_type == 'laundry':
                dept_name = "Buồng phòng & Giặt là"
                dept_title = f"Báo Giặt là chuẩn bị đồ: Phòng {room_label}"
                dept_message = (
                    f"Khách phòng {room_label} ({guest_name}) đã nhận phòng. "
                    f"Dịch vụ giặt ủi: \"{service_name}\" (SL: {service_req.quantity})."
                    f"{time_notice} "
                    f"Vui lòng tiếp nhận và thu gom đồ giặt đúng giờ!"
                )
            else:  # amenities / other
                dept_name = "Buồng phòng"
                dept_title = f"Báo Buồng phòng chuẩn bị tiện ích: Phòng {room_label}"
                dept_message = (
                    f"Khách phòng {room_label} ({guest_name}) đã nhận phòng. "
                    f"Yêu cầu tiện ích: \"{service_name}\" (SL: {service_req.quantity})."
                    f"{time_notice} "
                    f"Vui lòng chuẩn bị và chuyển lên phòng cho khách!"
                )

            staff_users = get_staff_and_admin_users(category_type=cat_type)
            notifs = [
                Notification(
                    recipient=staff,
                    title=dept_title,
                    message=dept_message,
                    notification_type='service',
                    action_url='/admin/services',
                    priority='normal'
                )
                for staff in staff_users
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception as e:
            print(f"Lỗi gửi thông báo cho nhân viên: {e}")
            dept_name = "phục vụ"

        # Ghi log thao tác
        user = request.user
        log_action(
            user=user if user.is_authenticated else None,
            action='NOTIFY',
            module='SERVICE',
            description=f"Lễ tân gửi thông báo nhắc chuẩn bị dịch vụ #{service_req.id} ({service_name}) cho bộ phận {dept_name} (Phòng {room_label}). {time_notice}",
            request=request
        )

        serializer = self.get_serializer(service_req, context={'request': request})
        return Response({
            'success': True,
            'message': f'Đã gửi thông báo nhắc chuẩn bị dịch vụ "{service_name}" cho bộ phận {dept_name} thành công!',
            'department': dept_name,
            'service_request_id': service_req.id,
            'status': service_req.status,
            'request_time': service_req.request_time,
            'data': serializer.data
        }, status=status.HTTP_200_OK)


    def _check_service_lock(self, service_req):
        """
        Kiểm tra điều kiện bắt đầu / thực hiện dịch vụ phòng (dùng chung cho PATCH đổi trạng thái và claim).
        Trả về Response lỗi 400 nếu bị khóa, hoặc None nếu được phép làm.
        - Dịch vụ vận chuyển luôn được phép.
        - Chưa gán phòng: chặn (ROOM_ASSIGNMENT_REQUIRED).
        - Chưa check-in: chặn ẩm thực / spa / giặt ủi (CHECKIN_REQUIRED); tiện ích buồng phòng vẫn được làm.
        """
        booking = service_req.booking
        if not booking:
            return None

        category_name = (service_req.service.category.name if service_req.service and service_req.service.category else "") or ""
        service_name = service_req.service.name if service_req.service else ""
        from ...notifications.signals import get_service_category_type
        cat_type = get_service_category_type(service_name, category_name)

        # Dịch vụ vận chuyển (xe đón tiễn sân bay) luôn được phép thực hiện trước
        if cat_type == 'transport':
            return None

        has_room = bool(booking.room and booking.room.room_number)
        is_checked_in = (booking.status == 'checked_in')

        # 1. Chưa gán phòng: Không thể thực hiện vì chưa biết mang vào phòng nào
        if not has_room:
            return Response({
                'success': False,
                'code': 'ROOM_ASSIGNMENT_REQUIRED',
                'message': f'Đơn #{booking.booking_code} chưa được gán phòng cụ thể. Vui lòng liên hệ Lễ tân gán số phòng trước khi thực hiện dịch vụ "{service_name}".'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Đã gán phòng nhưng khách chưa Check-in:
        # - Cho phép: Dịch vụ buồng phòng / tiện nghi phòng (Set gối, khăn, nệm, giường phụ, setup phòng...)
        # - Chặn: Dịch vụ ẩm thực (F&B), spa trị liệu, giặt ủi cần khách có mặt tại phòng
        if not is_checked_in and cat_type in ['fnb', 'spa', 'laundry']:
            service_group_label = "ẩm thực & đồ uống" if cat_type == 'fnb' else ("spa trị liệu" if cat_type == 'spa' else "giặt ủi")
            return Response({
                'success': False,
                'code': 'CHECKIN_REQUIRED',
                'message': f'Khách hàng đơn #{booking.booking_code} chưa hoàn tất thủ tục nhận phòng (Check-in). Dịch vụ {service_group_label} "{service_name}" yêu cầu khách có mặt tại phòng để phục vụ trực tiếp. Vui lòng đợi khách nhận phòng!'
            }, status=status.HTTP_400_BAD_REQUEST)

        return None


    def _check_staff_service_permission(self, user, service_req, action_name='xử lý'):
        """
        Kiểm tra phân quyền theo vai trò nghiệp vụ (RBAC) cho đơn dịch vụ:
        - Admin, Owner, Manager, Receptionist: Toàn quyền điều phối.
        - Service Staff: Xử lý F&B, Spa, Transport, Laundry, Amenities.
        - Housekeeper: Chỉ xử lý Amenities, Laundry hoặc dịch vụ buồng phòng / setup phòng.
        - Technician, Cashier: Không có nhiệm vụ xử lý đơn dịch vụ khách hàng.
        """
        if user.is_superuser:
            return None

        user_role = getattr(user, 'role', '')
        if user_role in ['admin', 'owner', 'manager', 'receptionist']:
            return None

        if user_role == 'technician':
            return Response({
                'success': False,
                'message': f'Vai trò Kỹ thuật viên không có nhiệm vụ {action_name} đơn dịch vụ khách hàng.'
            }, status=status.HTTP_403_FORBIDDEN)

        if user_role == 'cashier':
            return Response({
                'success': False,
                'message': f'Vai trò Thu ngân không có nhiệm vụ {action_name} đơn dịch vụ hiện trường.'
            }, status=status.HTTP_403_FORBIDDEN)

        category_name = (service_req.service.category.name if service_req.service and service_req.service.category else "") or ""
        service_name = service_req.service.name if service_req.service else ""
        from ...notifications.signals import get_service_category_type
        cat_type = get_service_category_type(service_name, category_name)

        if user_role == 'housekeeper' and cat_type in ['fnb', 'transport', 'spa']:
            return Response({
                'success': False,
                'message': f'Nhân viên Buồng phòng chỉ phụ trách dịch vụ tiện ích, đồ vải và setup phòng. Bạn không thể {action_name} đơn "{service_name}".'
            }, status=status.HTTP_403_FORBIDDEN)

        return None


    @action(detail=True, methods=['post'], url_path='claim')
    def claim(self, request, pk=None):
        """
        Nhân viên / Tài xế bấm nhận việc từ App Mobile:
        POST /api/services/requests/<id>/claim/
        """
        service_req = self.get_object()
        user = request.user
        if not user.is_authenticated:
            return Response({
                'success': False,
                'message': 'Vui lòng đăng nhập để tiếp nhận công việc.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        user_role = getattr(user, 'role', '')
        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            (user_role and user_role != 'guest')
        )
        if not is_staff_or_admin:
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên khách sạn mới có quyền tiếp nhận xử lý dịch vụ.'
            }, status=status.HTTP_403_FORBIDDEN)

        perm_resp = self._check_staff_service_permission(user, service_req, action_name='tiếp nhận')
        if perm_resp is not None:
            return perm_resp

        # Chốt chặn chống tranh chấp / ghi đè đơn (Race Condition Claim Guard):
        # Nếu đơn đã có nhân viên khác tiếp nhận (và không có cờ force), từ chối ghi đè để tránh 2 nhân viên cùng làm 1 đơn
        force_claim = str(request.data.get('force', '')).lower() in ['1', 'true', 'yes']
        if service_req.assigned_staff and service_req.assigned_staff != user and not force_claim:
            assigned_name = service_req.assigned_staff.get_full_name().strip() or service_req.assigned_staff.username
            return Response({
                'success': False,
                'message': f'Đơn này đã được nhân viên "{assigned_name}" tiếp nhận xử lý trước đó.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Nhận việc khi đơn đang pending = chuyển sang in_progress -> phải qua cùng điều kiện khóa như PATCH
        if service_req.status == 'pending':
            lock_response = self._check_service_lock(service_req)
            if lock_response is not None:
                return lock_response

        # Gán nhân viên tiếp nhận
        service_req.assigned_staff = user
        update_fields = ['assigned_staff', 'updated_at']

        # Nếu đang ở pending -> tự động chuyển sang in_progress
        if service_req.status == 'pending':
            service_req.status = 'in_progress'
            update_fields.append('status')

        service_req.save(update_fields=list(set(update_fields)))
        service_req.refresh_from_db()

        staff_name = user.get_full_name() or user.username
        service_name = service_req.service.name if service_req.service else "Dịch vụ"
        log_action(
            user=user,
            action='UPDATE',
            module='SERVICE',
            description=f"Nhân viên {staff_name} tiếp nhận yêu cầu #{service_req.id} ({service_name})",
            request=request
        )

        serializer = self.get_serializer(service_req, context={'request': request})
        return Response({
            'success': True,
            'message': f'Bạn đã tiếp nhận yêu cầu "{service_name}" (#{service_req.id}) thành công!',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


    @action(detail=True, methods=['post'], url_path='assign')
    def assign_staff(self, request, pk=None):
        """
        Lễ tân / Quản lý phân công nhân viên / tài xế cho đơn:
        POST /api/services/requests/<id>/assign/
        Body: { "staff_id": 12 }
        """
        user = request.user
        user_role = getattr(user, 'role', '')
        if not (user.is_authenticated and (user.is_superuser or user_role in ['admin', 'owner', 'manager', 'receptionist'])):
            return Response({
                'success': False,
                'message': 'Chỉ Quản lý hoặc Lễ tân mới có quyền phân công nhân viên thực hiện dịch vụ.'
            }, status=status.HTTP_403_FORBIDDEN)
        service_req = self.get_object()
        staff_id = request.data.get('staff_id')
        if not staff_id:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn nhân viên cần phân công.'
            }, status=status.HTTP_400_BAD_REQUEST)

        from ...users.models import User
        target_staff = User.objects.filter(pk=staff_id).first()
        if not target_staff:
            return Response({
                'success': False,
                'message': 'Không tìm thấy nhân viên được chỉ định.'
            }, status=status.HTTP_404_NOT_FOUND)

        service_req.assigned_staff = target_staff
        update_fields = ['assigned_staff', 'updated_at']
        if service_req.status == 'pending':
            service_req.status = 'in_progress'
            update_fields.append('status')

        service_req.save(update_fields=list(set(update_fields)))
        service_req.refresh_from_db()

        staff_name = target_staff.get_full_name() or target_staff.username
        service_name = service_req.service.name if service_req.service else "Dịch vụ"
        log_action(
            user=request.user if request.user.is_authenticated else None,
            action='UPDATE',
            module='SERVICE',
            description=f"Phân công yêu cầu #{service_req.id} ({service_name}) cho nhân viên {staff_name}",
            request=request
        )

        serializer = self.get_serializer(service_req, context={'request': request})
        return Response({
            'success': True,
            'message': f'Đã phân công yêu cầu #{service_req.id} cho {staff_name} thành công!',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
