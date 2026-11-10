"""Mixin: thêm / xoá dịch vụ phát sinh của booking."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import transaction
from ..models import BookingExtraService
from ...users.models import log_action
from ...users.views import check_role_permission
from ...services.models import ServiceItem, ServiceRequest


class BookingExtraServicesMixin:
    """Mixin: thêm / xoá dịch vụ phát sinh của booking."""


    @action(detail=True, methods=['post'], url_path='add-extra-service')
    def add_extra_service(self, request, pk=None):
        """
        Lễ tân / Quản trị viên thêm dịch vụ phát sinh hoặc gọi món cho đơn đặt phòng:
        - Dành cho khách yêu cầu tại quầy lễ tân hoặc gọi điện thoại.
        - Khách đặt thêm món ăn / nước uống / dịch vụ khách sạn.
        - Ghi nhận phụ thu tùy chỉnh (minibar, đền bù đồ vỡ, check-in sớm, v.v.).
        POST /api/bookings/<id>/add-extra-service/
        """
        booking = self.get_object()
        user = request.user

        # 1. Kiểm tra phân quyền: Yêu cầu quyền cập nhật đơn đặt phòng hoặc tạo yêu cầu dịch vụ
        can_add = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'owner'] or
            check_role_permission(user, 'bookings', 'update') or
            check_role_permission(user, 'services', 'create')
        )
        if not can_add:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thêm dịch vụ vào đơn đặt phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        if booking.status == 'cancelled':
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} đã bị hủy. Không thể thêm dịch vụ phát sinh.'
            }, status=status.HTTP_400_BAD_REQUEST)

        service_id = request.data.get('service_id')
        custom_name = (request.data.get('custom_name') or request.data.get('service_name') or '').strip()

        try:
            quantity = int(request.data.get('quantity', 1))
            if quantity < 1 or quantity > 99:
                return Response({
                    'success': False,
                    'message': 'Số lượng dịch vụ phải nằm trong khoảng từ 1 đến 99.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            quantity = 1

        price_input = request.data.get('price')
        note = (request.data.get('note') or '').strip()
        service_status = request.data.get('service_status', 'completed')
        if service_status not in ['completed', 'pending', 'in_progress']:
            service_status = 'completed'

        if not service_id and not custom_name:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn một dịch vụ từ danh mục hoặc nhập tên phụ phí tùy chỉnh.'
            }, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        staff_name = user.get_full_name() or user.username if user.is_authenticated else 'Lễ tân'

        with transaction.atomic():
            if service_id:
                service_item = ServiceItem.objects.filter(pk=service_id).first()
                if not service_item:
                    return Response({
                        'success': False,
                        'message': 'Dịch vụ được chọn không tồn tại trong hệ thống.'
                    }, status=status.HTTP_404_NOT_FOUND)

                try:
                    unit_price = float(price_input) if price_input is not None and str(price_input).strip() != '' else float(service_item.price)
                    if unit_price < 0:
                        raise ValueError()
                except (ValueError, TypeError):
                    return Response({
                        'success': False,
                        'message': 'Đơn giá dịch vụ không hợp lệ hoặc không được là số âm.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                total_price = unit_price * quantity
                clean_name = service_item.name.strip()

                auto_note = note or f"Lễ tân {staff_name} tiếp nhận tại quầy / qua điện thoại"

                req_time_input = request.data.get('request_time')
                is_scheduled_input = request.data.get('is_scheduled', False)
                if isinstance(is_scheduled_input, str):
                    is_scheduled_input = is_scheduled_input.lower() in ('true', '1')

                req_target_time = now
                if req_time_input:
                    parsed_dt = parse_datetime(str(req_time_input))
                    if parsed_dt:
                        if timezone.is_naive(parsed_dt):
                            req_target_time = timezone.make_aware(parsed_dt)
                        else:
                            req_target_time = parsed_dt
                        if is_scheduled_input is False:
                            is_scheduled_input = True

                req = ServiceRequest.objects.create(
                    booking=booking,
                    service=service_item,
                    quantity=quantity,
                    total_price=total_price,
                    status=service_status,
                    note=auto_note,
                    request_time=req_target_time,
                    is_scheduled=bool(is_scheduled_input)
                )

                if service_status == 'completed':
                    # Đồng bộ vào BookingExtraService để tính vào hóa đơn
                    service_name_bill = f"{clean_name} [Yêu cầu #{req.id}]"
                    BookingExtraService.objects.create(
                        booking=booking,
                        service_name=service_name_bill,
                        quantity=quantity,
                        price=unit_price
                    )
                    msg = f'Đã thêm dịch vụ "{clean_name}" (x{quantity}) vào hóa đơn thanh toán thành công!'
                else:
                    msg = f'Đã tạo yêu cầu "{clean_name}" (x{quantity}) thành công! Đã gửi thông báo đến bộ phận liên quan để chuẩn bị.'

            else:
                # Custom name (phụ phí ngoài menu: minibar, đền bù, phụ thu, v.v.)
                if price_input is None or str(price_input).strip() == '':
                    return Response({
                        'success': False,
                        'message': 'Vui lòng nhập đơn giá cho khoản phụ thu này.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                try:
                    unit_price = float(price_input)
                    if unit_price < 0:
                        raise ValueError()
                except ValueError:
                    return Response({
                        'success': False,
                        'message': 'Đơn giá không hợp lệ. Vui lòng nhập số tiền lớn hơn hoặc bằng 0.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                bes_name = custom_name
                if note:
                    bes_name = f"{custom_name} ({note})"

                BookingExtraService.objects.create(
                    booking=booking,
                    service_name=bes_name,
                    quantity=quantity,
                    price=unit_price
                )
                msg = f'Đã ghi nhận phụ phí "{custom_name}" (x{quantity}) vào đơn đặt phòng thành công!'

        # Trả về đối tượng Booking đã cập nhật mới nhất
        booking.refresh_from_db()

        log_action(
            user=request.user,
            action='CREATE',
            module='BOOKING',
            description=f'{msg} cho đơn đặt phòng #{booking.booking_code}',
            request=request
        )

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': msg,
            'booking': serializer.data,
            **serializer.data
        }, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=['post'], url_path='remove-extra-service')
    def remove_extra_service(self, request, pk=None):
        """
        Lễ tân / Quản trị viên xóa phụ phí hoặc dịch vụ khỏi đơn đặt phòng:
        POST /api/bookings/<id>/remove-extra-service/
        Payload: { "item_id": "req_9" | 3 }
        """
        booking = self.get_object()
        user = request.user

        can_remove = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'owner'] or
            check_role_permission(user, 'bookings', 'update')
        )
        if not can_remove:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xóa phụ phí dịch vụ của đơn đặt phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        item_id = str(request.data.get('item_id', '')).strip()
        if not item_id:
            return Response({
                'success': False,
                'message': 'Vui lòng cung cấp mã dịch vụ / phụ phí cần xóa.'
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if item_id.startswith('req_'):
                try:
                    req_id = int(item_id.replace('req_', ''))
                    ServiceRequest.objects.filter(pk=req_id, booking=booking).delete()
                    BookingExtraService.objects.filter(booking=booking, service_name__contains=f"[Yêu cầu #{req_id}]").delete()
                except (ValueError, TypeError):
                    pass
            elif item_id.isdigit():
                BookingExtraService.objects.filter(pk=int(item_id), booking=booking).delete()
            else:
                BookingExtraService.objects.filter(pk=item_id, booking=booking).delete()

        booking.refresh_from_db()

        log_action(
            user=request.user,
            action='DELETE',
            module='BOOKING',
            description=f'Xóa dịch vụ / phụ phí (Mã {item_id}) khỏi đơn đặt phòng #{booking.booking_code}',
            request=request
        )

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': 'Đã xóa dịch vụ / phụ phí khỏi đơn đặt phòng thành công.',
            'booking': serializer.data,
            **serializer.data
        }, status=status.HTTP_200_OK)
